"use strict";

const config = require('config');
const { logMgr } = require('./logger.js');

const { TelnetConnection, } = require("./telnet-client");
const { hexDump } = require("./hex-dump");
const { parseIntDecOrHex } = require("./parse-int-dec-or-hex");
const { sleep } = require("./sleep");

const { SerialComms, SerialResponse, SerialCommsError } = require("./serial-comms");
const { BscFrame, BscFrameCreator, ResponseBscFrame } = require('./bsc-frame');
const { BSC, EBCDIC} = require('./bsc-protocol');

/**
 * Encapsulate the connection to the telnet server. Forward data
 * to the BscTerminal instance, which will be queued for sending
 * to the terminal device.
 */
class TerminalToTn3270 {

    static telnetHost = config.get("telnet.host");
    static telnetPort = config.get("telnet.port");

    constructor(pollAddress, terminalType, addQueuedDataFunction ) {
        this.pollAddress = parseIntDecOrHex(pollAddress);
        this.terminalType = terminalType;
        this.addQueuedDataFunction = addQueuedDataFunction;
    }

    async start() {

        this.telnetClient = new TelnetConnection(TerminalToTn3270.telnetHost, TerminalToTn3270.telnetPort);
        this.telnetClient.terminalType = this.terminalType;

        let xthis = this;
        this.telnetClient.registerDataReceiver((data) => {
            xthis.dataReceivedFromServer(data);
        });
        await this.telnetClient.connect();

    }

    async close() {
        this.telnetClient.close();
    }

    async dataReceivedFromServer(data) {
        console.log('Received data');
        hexDump(console.log, `telnet < ${this.pollAddress}`, 0x20, data, data.length, true);
        this.addQueuedDataFunction(data);
    }

    async sendQueuedData() {
        if ( this.lineSendQueue.length == 0 )
            return;

        for (let x=0; x<this.lineSendQueue.length; x++) {
            await this.bisyncLine.sendData( this.pollAddress, this.lineSendQueue[x] );
        }
    }

    async sendRecord(data) {
        await this.telnetClient.sendRecord(data);
    }

}

class BscErrorUnexpectedResponse extends Error {
    constructor(msg) {
        super(msg);
    }
}

class BscErrorLineError extends Error {
    constructor(msg) {
        super(msg);
    }
}

/**
 * An instance of this class is used to represent a terminal attached
 * the BSC attached controller. The class provides glue between the
 * TN3270 terminal connection and the BSC line on which we communicate
 * with the controller.
 */
class BscTerminal {
    constructor(cuAddress, terminalAddress, terminalType, bisyncLine) {
        this.cuAddress = cuAddress;             // Device address, not the character
        this.terminalAddress = terminalAddress;     // Device address, not the character

        this.terminalType = terminalType;
        this.bisyncLine = bisyncLine;

        this.queuedDataToBeSent = [];

        xthis = this;
        this.tn3270Handler = new TerminalToTn3270(
            pollAddress,
            terminalType,
            (data) => { xthis.addQueuedData(data); }
        );
    }

    /**
     * This function is called by the TN3270 handler to saved data to the queue, which will be
     * forwarded to the actual terminal over the BSC line.
     * @param {*} data
     */
    addQueuedData(data) {
        this.queuedDataToBeSent.push(data);
    }

    async startt() {
        await this.tn3270Handler.start();
    }

    async close() {
        await this.tn3270Handler.close();
    }

    async pollForInput() {
        await sleep(10);
        await this.bisyncLine.sendPoll( this.pollAddress );
    }

    async pollForInput() {
        /*

        (1) Reset the line (EOT) ... no response expected.

        (2) Poll the device
            loop while more data to receive
                Get the response frame
                If timeout then end processing
                If EOT then no more data to receive -- break from loop
                If status message (has SOH % R) -- then process
                If test request message  (has SOH % /) then process
                If read modified response (AID, CURSOR, optional data) then process
                If short read modified response (AID) then process
                Send ACK1 or ACK0
            End loop


        Processing status message -- for now ignore
        Processing test message -- for now ignore
        Processing read modified response -- add the data to the buffer to be forwarded to TN3270 server
        Processing short read modified response -- add the data to the buffer to be forwarded to TN3270 server
        */

       // This is the data we will send back to the telnet server.
       let responseData = [];

        // (1) - Send EOT to reset line
        let frame, responseFrame;
        frame = BscFrameCreator.makeFrameEot();
        await this.bisyncLine.sendFrame(frame);     // No response expected.

        // (2) - Send the poll
        frame = BscFrameCreator.makeFramePollAddress(this.cuAddress, this.terminalAddress);
        responseFrame = await this.bisyncLine.sendFrameAndGetResponse(frame);     // Response expected.
        let ackType = 1;
        while( responseFrame.getResponseStatus() !== ResponseBscFrame.FRAME_TYPE_EOT ) {
            switch( responseFrame.getResponseStatus() ) {
                case ResponseBscFrame.RESPONSE_TIMEOUT:
                    return;

                case ResponseBscFrame.FRAME_TYPE_TEXT:
                case ResponseBscFrame.FRAME_TYPE_TRANSPARENT_TEXT:
                    if ( responseFrame.hasHeader() ) {
                        // TODO: Not doing anything with these yet!
                    } else {
                        let dataSection = false;
                        responseFrame.forEachTextByte( (dataByte) => responseData.push(dataByte) );
                    }
                    break;

            }

            frame = BscFrameCreator.makeFrameAck(ackType);
            responseFrame = await this.bisyncLine.sendFrameAndGetResponse(frame);     // Response expected.
            ackType = ackType ? 0 : 1;
        }

        await this.tn3270Handler.sendRecord(responseData);
    }

    async sendQueuedData() {
        // If no queued data we can exit.
        if ( this.queuedDataToBeSent.length == 0 )
            return;

        let data = this.queuedDataToBeSent.shift();

        /*

        (1)  Reset the line (EOT) ... no response expected.

        (2)  Select the device
             Get the response
             If timeout then device not available ... end processing for device.
             If RVI then device has pending status... end processing and next poll will get status.
             If WACK then device busy ... end processing for this send.
             If ACK0 then continue.

        (3)  Send the data

             Loop until end of data
                Create a frame
                Add SYN and DLE STX
                Loop until frame has 252 bytes of data (or end of data)
                    Add byte
                Add DLE ETB (or DLE ETX if end of data)
                Send loop until send cnt > 4
                    Send the frame
                    Get the response
                    If ACK1 or ACK0 then do next frame
                    If NAK or ENQ then resend frame
                    If EOT then cease send data ... exit for next device or poll.
                    If timeout then resend frame

        (4)  Send an EOT to finish up the send.
        */

        // (1) - Send EOT to reset line
        let frame, responseFrame;
        frame = BscFrameCreator.makeFrameEot();
        await this.bisyncLine.sendFrame(frame);     // No response expected.

        // (2) - Send the select
        frame = BscFrameCreator.makeFrameSelectAddress(this.cuAddress, this.terminalAddress);
        responseFrame = await this.bisyncLine.sendFrameAndGetResponse(frame);     // Response expected.

        switch( responseFrame.getResponseStatus() ) {
            case ResponseBscFrame.RESPONSE_TIMEOUT:
            case ResponseBscFrame.FRAME_TYPE_RVI:
            case ResponseBscFrame.FRAME_TYPE_WACK:
                return;

            // Good response from select ... continue
            case ResponseBscFrame.FRAME_TYPE_ACK:
                break;

            // Something else, then we're done.
            default:
                return;
        }

        // (3) - Send the data in multiple text blocks if necessary.
        //       Send as transparent data to support extended highlighting and attrtibutes in the
        //       3270 datastream.

        while ( data.length > 0 ) {
            frame = new BscFrame();
            frame.pushEscapedDataByte( BSC.STX )
            frame.pushDataByte( EBCDIC.ESC );
            while ( frame.frameSize <= 252 && data.length > 0 ) {
                frame.pushDataByte( data.shift() );
            }
            if ( data.length == 0 )
                frame.pushEscapedDataByte(BSC.ETX); // This is the last block of data
            else
                frame.pushEscapedDataByte(BSC.ETB); // Not the last block
            let sendCount = 0;
            while ( sendCount < 4 ) {
                responseFrame = await this.bisyncLine.sendFrameAndGetResponse(frame);     // Response expected.
                switch( responseFrame.getResponseStatus() ) {
                    case ResponseBscFrame.RESPONSE_TIMEOUT:
                        return;

                    case ResponseBscFrame.FRAME_TYPE_NAK:
                    case ResponseBscFrame.FRAME_TYPE_ENQ:
                        continue;   // Resend

                    // Good response from select ... break out of the resend loop to send next frame
                    case ResponseBscFrame.FRAME_TYPE_ACK:
                        break;

                    // Something else, then we're done.
                    default:
                        return;
                }
            }
        }

        // (4) Send EOT to finish everything off.
        frame = BscFrameCreator.makeFrameEot();
        await this.bisyncLine.sendFrame(frame);     // No response expected.
    }

}

/**
 * This class instance represents a BSC line on which a single 3274/3174
 * cluster controller is attached, which in turn has a number of terminal
 * devices attached.
 *
 * The physical synchronous communications line is accessed via a serial port
 * which converts the USB (or asynch serial) to synchronous serial, with
 * required clock signals.
 */
class BisyncLine {

    static telnetTerminalType = config.get("telnet.terminal-type");
    static FRAME_XMIT_RETRY_LIMIT = 3;
    static RESPONSE_TIMEOUT = 20000;

    // These are the two basic commands sent to the usb-bsc-dongle.
    static CMD_WRITREAD    = 0x01;      // Write followed by a read to get response
    static CMD_WRITE       = 0x02;      // Write with no read (no response/ack expected)

    constructor() {
        this.bscTerminals = [];
        this.frameCount = 0;
    }

    addDevice(pollAddress, terminalType) {
        this.bscTerminals.push( new BscTerminal( pollAddress, terminalType, this) );
    }

    addDevices(terminalList) {
        terminalList.forEach( terminal => {
            this.addDevice(
                terminal.address,
                terminal.type || BisyncLine.telnetTerminalType
            );
        });
    }

    async connectDevices() {
        for ( let x=0; x<this.bscTerminals.length; x++) {
            await this.bscTerminals[x].start();
        }
    }

    async closeDevices() {
        for ( let x=0; x<this.bscTerminals.length; x++) {
            await this.bscTerminals[x].close();
        }
    }

    async runLoop() {
        // do until shutdown ...
        while ( this.runFlag ) {
            // For each device, poll for input .. or replace this loop with a general poll.
            for (let x = 0; x < this.bscTerminals.length && this.runFlag; x++) {
                await this.bscTerminals[x].pollForInput();
            }
            // For each device, send any queued data on the BSC line.
            for ( let x=0; x<this.bscTerminals.length && this.runFlag; x++) {
                await this.bscTerminals[x].sendQueuedData();
            }
        }
    }

    async setupSerialPort() {
        let portPath = config.get("line.serial-device");
        this.serialComms = new SerialComms(portPath);
        this.serialComms.start();
    }

    /*
    async testRun() {
        let frame;
        while(1) {

            // **** 1 ******
            // EOT and POLL
            frame = new BscFrame(null, Buffer.from([
                BSC.TRAILING_PAD, BSC.LEADING_PAD, BSC.LEADING_PAD,
                BSC.SYN, BSC.SYN, BSC.EOT,
                BSC.TRAILING_PAD,
                BSC.TRAILING_PAD,
                BSC.SYN, BSC.SYN,
                0x40, 0x40, 0x40, 0x40,
                BSC.ENQ,
                BSC.TRAILING_PAD
            ]));
            await this.sendFrame(BisyncLine.CMD_WRITE, frame);
            await sleep(300);


            // **** 2 *****
            await sleep(1);


            // EOT
            frame = new BscFrame(null, Buffer.from([
                BSC.TRAILING_PAD, BSC.LEADING_PAD, BSC.LEADING_PAD,
                BSC.SYN, BSC.SYN, BSC.EOT,
                BSC.TRAILING_PAD,
            ]));
            await this.sendFrame(BisyncLine.CMD_WRITE, frame);
            await sleep(200);

            // SELECT
            frame = new BscFrame(null, Buffer.from([
                BSC.TRAILING_PAD,
                BSC.SYN, BSC.SYN,
                0x60, 0x60, 0x40, 0x40,
                BSC.ENQ,
                BSC.TRAILING_PAD

            ]));
            await this.sendFrame(BisyncLine.CMD_WRITE, frame);
            await sleep(100);

            // **** 3 *****
            frame = new BscFrame(300, Buffer.from([
                BSC.SYN, BSC.SYN,
                BSC.DLE, BSC.STX,
                0x27, 0xF5, 0x42,
                0x11, 0x40, 0x40,
                0x1D, 0x60,
                0xC8, 0xC5, 0xD3, 0xD3, 0xD6, 0x40, 0xE6, 0xD6, 0xD9,
                0x40, 0x40,
                0x13,
                BSC.DLE, BSC.ETX,
            ]));
            BSC.addBccToFrame(frame);
            frame.push(BSC.TRAILING_PAD);
            await this.sendFrame(BisyncLine.CMD_WRITE, frame);
            await sleep(3000);

            frame = new BscFrame(null, Buffer.from([
                BSC.SYN, BSC.SYN,
                BSC.STX,
                0x27, 0xF6,
                BSC.ETX,
            ]));
            //BSC.addBccToFrame(frame);
            //frame.push(BSC.TRAILING_PAD);
            await this.sendFrame(BisyncLine.CMD_WRITE, frame);
            await sleep(2000);

        }

    }
    */
    async run() {
        this.controllerAddress = config.get("line.controller-address");
        this.serialDevice = config.get("line.serial-device");
        let terminalList = config.get("line.terminals");

        await this.setupSerialPort();

        this.addDevices(terminalList);
        await sleep(3000);

        await this.connectDevices();

        await sleep(1000);
        await this.sendCommand(SerialComms.CMD_RESET);

        // await sleep(10000);
        // await this.testRun();

         this.runFlag = true;
         await this.runLoop();

        await sleep(10000);

        await this.closeDevices();
    }

    async stop() {
        this.runFlag = false;
    }
/*
    async sendCommand(command, dataSize = 0) {
        this.serialComms.sendCommand(command, dataSize);
    }

    async sendFrame(frame) {
        this.frameCount++;
        await this.sendCommand(SerialComms.CMD_WRITE, frame.frameSize);
        hexDump(logMgr.debug, 'BSC frame out', 0x20, frame, frame.frameSize, true);
        this.serialComms.sendSerial(frame);
    }
*/
    translateSerialResponseCode(code) {
        switch(code) {
            case SerialComms.CMD_RESPONSE_OK:
                return null;

            case SerialComms.CMD_RESPONSE_TIMEOUT:
                return ResponseBscFrame.RESPONSE_TIMEOUT;

            default:
                return ResponseBscFrame.RESPONSE_OTHER_ERROR;
        }
    }

    async sendFrameAndGetResponse(frame) {
        let serialResponse = await this.serialComms.sendFrameAndGetResponse(frame);
        let responseBscFrame = new ResponseBscFrame(serialResponse.data,
            this.translateSerialResponseCode(serialResponse.responseCode));
        return responseBscFrame;
    }

/*
    async getResponse() {
        // Turn the line around and put the line in ready to receive /
        // clear to send etc.
        //await this.sendCommand(BisyncLine.CMD_READ);

        let response = await this.serialComms.receiveSerial(
            BisyncLine.RESPONSE_TIMEOUT);

        if ( response.error ) {
            logMgr.error(response.error);

            //throw new BscErrorLineError(response.error);
            return;
        }

        let responseFrameData = response.data;

        logMgr.debug(`Returned from this.serialComms.receiveData() typeof responseFrameData is ${responseFrameData.constructor.name}`);

        hexDump(logMgr.debug, 'BSC frame in', 0x20, responseFrameData, responseFrameData.length, true);

        let responseFrame = BscFrame.createFrame(responseFrameData);
        return responseFrame;
    }
*/
/*
    async sendFrameAndGetResponse(frame) {
        let ack = false;
        let retries = 0;
        let response;
        while ( !ack && retries <= BisyncLine.FRAME_XMIT_RETRY_LIMIT ) {
            await this.sendFrame(frame);
            // get response ...
            response = await this.serialComms.receiveSerial(
                BisyncLine.RESPONSE_TIMEOUT);

            // Check for ACK/NAK
            if ( this.isAck(response) ) {
                break;
            }
        }
        return response;
    }
    isAck(response) {
        return true;
    }

    resetLine() {
        this.frameCount = 0;
    }

    async sendPoll( deviceSubAddress ) {
        let frame = BSC.makeFramePollAddress(this.controllerAddress, deviceSubAddress);
        await this.sendFrame(BisyncLine.CMD_WRITE, frame);
        // Turn the line around and put the line in ready to receive /
        // clear to send etc.
        await this.sendCommand(BisyncLine.CMD_READ);
        let response = await this.getResponse();

    }
*/
    /**
     *  Send the data across the serial line, constructing BSC frames and awaiting
     *  for ACKs.
     */
/*
    async sendData( deviceSubAddress, dataBuffer ) {
        let useDataBuffer = dataBuffer;
        if ( dataBuffer instanceof Buffer )
            useDataBUffer = Uint8Array(dataBuffer);

        // Reset line
        this.resetLine();

        logMgr.debug(`Controller address = ${this.controllerAddress}, deviceSubAddress=${deviceSubAddress}`);

        // Select
        let frame = BSC.makeFrameSelectAddress(this.controllerAddress, deviceSubAddress);
        await this.sendFrame(BisyncLine.CMD_WRITE, frame);

        // Turn the line around and put the line in ready to receive /
        // clear to send etc.
        await this.sendCommand(BisyncLine.CMD_READ);
        let response = await this.getResponse();

        // Need an ACK back to continue
        if ( response.getFrameType() != BscFrame.FRAME_TYPE_ACK )
            throw new BscErrorUnexpectedResponse(response);


        // Chop the dataBuffer into blocks, based on a length of 251 data characters
        let dataBlockLength = 251;

        let dataPtr = 0;
        let chunk = [];
        while ( dataPtr < useDataBuffer.length ) {
            if ( useDataBuffer[dataPtr] === BSC.DLE ) {
                // DLE chars must be doubled.
                chunk.push(BSC.DLE);
                chunk.push(BSC.DLE);
            } else {
                chunk.push(useDataBuffer[dataPtr]);
            }
            dataPtr++;
            if ( dataPtr >= useDataBuffer.length ||
                 chunk.length >= dataBlockLength ) {
                // Note that we use transparent text mode here (regardless of the data content)
                // because then we don't have be to concerned about only breaking the stream
                // on command boundaries. See 3270 documentation on BSC usage.
                frame = BSC.makeFrameCommand(chunk,
                    dataPtr >= useDataBuffer.length,
                    true);
                // Send it.
                this.sendFrame(BisyncLine.CMD_WRITE, frame);
                this.sendCommand(BisyncLine.CMD_READ);
                response = await this.getResponse();
                if ( response.getFrameType() != BscFrame.FRAME_TYPE_ACK )
                    throw new BscErrorUnexpectedResponse(response);

                chunk = [];
            }
        }

        frame = BSC.makeFrameEot();
        this.sendFrame(BisyncLine.CMD_WRITE, frame);

    }
*/

}

module.exports.BisyncTerminal = TerminalToTn3270;
module.exports.BisyncLine = BisyncLine;


class Bridge {
    constructor(destHost = 'LOCALHOST', destPort = 3270, model = 'IBM-3278-2') {
        this.destinationHost = destHost;
        this.destinationPort = destPort;
        this.model = model;
    }

    async startBridge() {
        this.bisyncLine = new BisyncLine();

        await this.bisyncLine.run();

    }

    async run() {
        await this.startBridge();
    }
}

module.exports.Bridge = Bridge;
