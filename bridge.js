"use strict";

const config = require('config');
const { logMgr } = require('./logger.js');

const { TelnetConnection, } = require("./telnet-client");
const { hexDump } = require("./hex-dump");
const { parseIntDecOrHex } = require("./parse-int-dec-or-hex");
const { sleep } = require("./sleep");

const {
    SerialComms,
    SerialCommsError } = require("./serial-comms");

const { BscFrame } = require('./bsc-frame');
const { BSC } = require('./bsc-protocol');

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

class BscTerminal {
    constructor(pollAddress, terminalType, bisyncLine) {
        this.pollAddress = pollAddress;
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


}

class BisyncLine {

    static telnetTerminalType = config.get("telnet.terminal-type");
    static FRAME_XMIT_RETRY_LIMIT = 3;
    static RESPONSE_TIMEOUT = 20000;

    static CMD_WRITE    = 0x01;
    static CMD_READ     = 0x02;
    static CMD_POLL     = 0x09;

    constructor() {
        this.bscTerminals = [];
        this.frameCount = 0;
    }

    addDevice(pollAddress, terminalType) {
        this.bscTerminals.push( new BscTerminal( pollAddress, terminalType, this) );
        //this.devices.push( new TerminalToTn3270(pollAddress, terminalType, this ) );
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
            // For each device, poll for input
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

    async run() {
        this.controllerAddress = config.get("line.controller-address");
        this.serialDevice = config.get("line.serial-device");
        let terminalList = config.get("line.terminals");

        await this.setupSerialPort();

//        this.addDevices(terminalList);
//        await sleep(3000);

//        await this.connectDevices();

        await sleep(1000);
        await this.sendCommand(SerialComms.CMD_RESET);

        await sleep(10000);
        await this.testRun();


        // this.runFlag = true;
        // await this.runLoop();

        await sleep(10000);

//        await this.closeDevices();
    }

    async stop() {
        this.runFlag = false;
    }

    async sendCommand(command, dataSize = 0) {
        this.serialComms.sendCommand(command, dataSize);
    }

    async sendFrame(command, frame) {
        this.frameCount++;
        await this.sendCommand(command, frame.frameSize);

        hexDump(logMgr.debug, 'BSC frame out', 0x20, frame, frame.frameSize, true);
        this.serialComms.sendSerial(frame);
    }

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
    */
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

    /**
     *  Send the data across the serial line, constructing BSC frames and awaiting
     *  for ACKs.
     */
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
                    /* isLastBlock = */ dataPtr >= useDataBuffer.length,
                    /* useTransparentMode = */ true);
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
