"use strict";

const config = require('config');
const { logMgr } = require('./logger.js');
const { crc16 } = require("crc");

const { TelnetConnection, } = require("./telnet-client");
const { hexDump } = require("./hex-dump");
const { parseIntDecOrHex } = require("./parse-int-dec-or-hex");
const { sleep } = require("./sleep");

const { 
    SerialComms,
    SerialCommsError } = require("./serial-comms");

class BisyncTerminal {

    static telnetHost = config.get("telnet.host");
    static telnetPort = config.get("telnet.port");

    constructor(pollAddress, terminalType, bisyncLine) {
        this.pollAddress = parseIntDecOrHex(pollAddress);
        this.bisyncLine = bisyncLine;
        this.terminalType = terminalType;
        this.lineSendQueue = [];
    }

    async start() {

        this.telnetClient = new TelnetConnection(BisyncTerminal.telnetHost, BisyncTerminal.telnetPort);
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
        this.lineSendQueue.push(data);
    }

    async sendQueuedData() {
        if ( this.lineSendQueue.length == 0 )
            return;

        for (let x=0; x<this.lineSendQueue.length; x++) {
            await this.bisyncLine.sendData( this.pollAddress, this.lineSendQueue[x] );
        }
    }

    async pollForInput() {
        await sleep(10);
        return;
    }
}

class BscFrame extends Uint8Array {

    static findStartOfFrame(frameData) {
        let idx = 0;
        while ( idx < frameData.length) {
            if ( frameData[idx] !== BSC.LEADING_PAD &&
                 frameData[idx] !== BSC.TRAILING_PAD &&
                 frameData[idx] !== BSC.SYN )
                 return idx;
            idx++;
        }
    }

    static findEndOfFrame(frameData) {
        let idx = frameData.length - 1;
        while (idx < frameData.length) {
            if (frameData[idx] !== BSC.LEADING_PAD &&
                frameData[idx] !== BSC.TRAILING_PAD &&
                frameData[idx] !== BSC.SYN)
                return idx + 1;
            idx--;
        }
    }

    static createFrame(frameData) {
        if ( !(frameData instanceof Buffer) )
            frameData = Buffer.from(frameData);

        // Input data might be something like this ...
        // PAD, PAD, SYNC, SYNC, SYNC, SYNC, DLE, ACK0, PAD, SYNC, SYNC, SYNC

        // Find the start of the frame, ignoring 
        // SYNC and PAD characters.
        let startOfFrame = this.findStartOfFrame(frameData);

        // Find the end of the frame, ignoring trailing PAD
        let endOfFrame = this.findEndOfFrame(frameData);

        // Return just the BSC frame such as
        // ACK0, ACK1, NAK
        // EOT
        // SOH ... STX ... ETX
        return new BscFrame(null,
            frameData.subarray(startOfFrame, endOfFrame) );
    }

    constructor(size = 300, initialData = null)  {
        if ( initialData &&  
             ( initialData instanceof Array ||
               initialData instanceof Buffer ||
               initialData instanceof Uint8Array ||
               initialData instanceof Int8Array ) && 
             size == null ) {
            size = initialData.length;
        }
        super(size);
        this.frameSize = 0;
        if ( initialData )
            this.push(initialData);

    }

    push(data) {
        if ( data instanceof Array
             || data instanceof Buffer
             || data instanceof Uint8Array
             || data instanceof Int8Array
              ) {
            for ( let x = 0; x<data.length; x++ )
                this[this.frameSize++] = data[x];
            return;
        }

        this[this.frameSize++] = data;
    }

    static FRAME_TYPE_EOT       = 1;
    static FRAME_TYPE_ENQ       = 2;
    static FRAME_TYPE_ACK       = 3;
    static FRAME_TYPE_NAK       = 4;
    static FRAME_TYPE_TEXT      = 5;
    static FRAME_TYPE_TRANSPARENT_TEXT = 6;
    static FRAME_TYPE_BAD       = -1;

    getFrameType() {
        if ( this[0] === BSC.EOT )
            return BscFrame.FRAME_TYPE_EOT
        else if ( this[0] === BSC.ENQ )
            return BscFrame.FRAME_TYPE_ENQ;
        else if ( this[0] === BSC.DLE &&
                  this.frameSize === 2 &&
                  ( this[1] === BSC.ACK0 || this[1] === BSC.ACK1 ) )
            return BscFrame.FRAME_TYPE_ACK;
        else if ( this[0] === BSC.NAK )
            return BscFrame.FRAME_TYPE_NAK;
        
        // Can we find a DLE-STX
        for ( let x = 0; x < this.frameSize - 1; x++ ) {
            if ( this[x] === BSC.DLE &&
                 this[x+1] === BSC.STX ) {
                    return BscFrame.FRAME_TYPE_TRANSPARENT_TEXT
            }
        }    
        // Can we find a STX
        for (let x = 0; x < this.frameSize; x++) {
            if (this[x] === BSC.STX) {
                return BscFrame.FRAME_TYPE_TEXT
            }
        }
        // Otherwise, bad frame.
        return BscFrame.FRAME_TYPE_BAD;    
    }
}

module.exports.BscFrame = BscFrame;

class BSC {
    // These the EBCDIC control codes. We are not attempting to support ASCII or SBT (six-bit) codes.
    static SYN   = 0x32;
    static IDLE  = BSC.SYN;

    static SOH   = 0x01;
    static STX   = 0x02;
    static ETB   = 0x26;
    static ENQ   = 0x2D;
    static ETX   = 0x03;
    static DLE   = 0x10;
    static NAK   = 0x3D;
    static ITB   = 0x1F; // IUS char
    static EOT   = 0x37;

    // These are preceeded by a DLE
    static ACK0  = 0x70;
    static ACK1  = 0x61;     // EBCDIC '/'
    static WACK  = 0x6B;     // EBCDIC ','
    static RVI   = 0x7C;     // EBCDIC '@'

    // This is preceeded by a STX
    static TTD   = BSC.ENQ;

    static LEADING_PAD = 0x55;
    static TRAILING_PAD = 0xff;

    // EBCDIC control
    ESC = 0x27;

    // A 256 entry array. If entry is "1" it is a BSC control character.
    static BSC_CONTROL_CHECK = new Uint8Array([
/*              0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F          */
/*      0 */    0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      1 */    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
/*      2 */    0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0,
/*      3 */    0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0,
/*      4 */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      5 */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      6 */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      7 */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      8 */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      9 */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      A */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      B */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      C */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      D */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      E */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
/*      F */    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]);

    static ADDRESS_CHARS_POLL = [
        /*  0 -  7 */  0x40, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 
        /*  8 - 15 */  0xC8, 0xC9, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,
        /* 16 - 23 */  0x50, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7,
        /* 24 - 31 */  0xD8, 0xD9, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F,
    ];
    
    static ADDRESS_CHARS_SELECT = [
        /*  0 -  7 */  0x60, 0x61, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7,
        /*  8 - 15 */  0xE8, 0xE9, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F,
        /* 16 - 23 */  0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7,
        /* 24 - 31 */  0xF8, 0xF9, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F,
    ];

    static getDevicePollChar(devAddress) {
        return this.ADDRESS_CHARS_POLL[devAddress]; 
    }

    static getDeviceSelectChar(devAddress) {
        return BSC.ADDRESS_CHARS_SELECT[devAddress];
    }

    static findStartEndForBcc(frame) {
        let transparentMode = false;
        let startOfCalc;

        let ptr = 0;
        while( frame[ptr] != BSC.STX && frame[ptr] != BSC.SOH )
            ptr++;

        if ( frame[ptr] == BSC.SOH ) {
            startOfCalc = ++ptr;
            while( frame[ptr] != BSC.STX )
                ptr++;
            if ( frame[ptr-1] == BSC.DLE )
                transparentMode = true;
        } else {
            if ( frame[ptr-1] == BSC.DLE )
                transparentMode = true;
            startOfCalc = ++ptr;  // Start CRC16 calculation at the byte after the STX
        }

        // Find the end, which will be ETX|ITB|ETB, or DLE-ETX|ITB|ETB
        if ( transparentMode ) {
            while( frame[ptr-1] != BSC.DLE
                && frame[ptr] != BSC.ETX
                && frame[ptr] != BSC.ITB
                && frame[ptr] != BSC.ETB
                && ptr < frame.length )
                ptr++;
        } else {
            while( frame[ptr] != BSC.ETX
                && frame[ptr] != BSC.ITB
                && frame[ptr] != BSC.ETB
                && ptr < frame.length )
                ptr++;
        }

        let endOfCalc = ptr + 1;

        return { startOfCalc: startOfCalc, endOfCalc: endOfCalc, transparentMode: transparentMode };
    }

    static addBccToFrame(frame) {

        let { startOfCalc, endOfCalc, transparentMode } = BSC.findStartEndForBcc(frame);

        let bccValue = crc16(frame.slice(startOfCalc, endOfCalc) );

        frame.push( 0x000000FF & bccValue );
        bccValue = bccValue>>8;
        frame.push( 0x000000FF & bccValue );

        return frame;
    }


    static makeFrameEot() {
        let frame = new BscFrame(null, [BSC.SYN, BSC.EOT, BSC.TRAILING_PAD]);
        return frame;
    }

    /**
     * Create a poll or select frame using the provided CU and
     * terminal dev address characters.
     * 
     * @param {*} cuChar 
     * @param {*} devChar 
     * @returns the constructed BSC frame
     */
    static makeFramePollSelectAddress(cuChar, devChar) {
        let frame = new BscFrame(null, [
            BSC.SYN, BSC.EOT, BSC.TRAILING_PAD,
            BSC.SYN,
            cuChar, cuChar,
            devChar, devChar,
            BSC.ENQ
        ]);
        return frame;
    }

    /** 
     * Make a select address frame, translating cuAddress to 
     * appropriate EBCDIC character code for select addressing.
     * Translate the terminal device address to an address
     * character using the poll address table.
     * 
     * @param {*} cuAddress - The control unit address (device number)
     * @param {*} devAddress - The terminal device address (device number)
     * @returns the constructed BSC frame
     */
    static makeFrameSelectAddress(cuAddress, devAddress) {
        // The CU, we use the select character.
        let cuChar = BSC.getDeviceSelectChar(cuAddress);
        // The terminal device, we use the poll character.
        let devChar = BSC.getDevicePollChar(devAddress);
        let frame = this.makeFramePollSelectAddress(cuChar, devChar);
        return frame;
    }

    /**
     * Make a poll address frame, translating cuAddress to 
     * appropriate EBCDIC character code for poll addressing.
     * Translate the terminal device address to an address
     * character using the poll address table.
     * 
     * @param {*} cuAddress - The control unit address (device number)
     * @param {*} devAddress - The terminal device address (device number)
     * @returns the constructed BSC frame
     */
    static makeFramePollAddress(cuAddress, devAddress) {
        // The CU and terminal, we use the poll character.
        let cuChar = this.getDevicePollChar(cuAddress);
        let devChar = this.getDevicePollChar(devAddress);

        let frame = this.makeFramePollSelectAddress(cuChar, devChar);
        return frame;
    }

    static hasBscControlChar(data) {
        if ( !data )
            return false;

        for( let x=0; x<data.length; x++ ) {
            if ( BSC.BSC_CONTROL_CHECK[data[x]] )
                return true;
        }
        return false;
    }

    static createFrameWithPrefix(useTransparentMode = false) {
        let frame = new BscFrame();

        // Use appropriate prefix
        if ( !useTransparentMode ) {
            frame.push([
                BSC.STX,
                BSC.ESC,
            ]);
        } else {
            frame.push([
                BSC.DLE, BSC.STX,
                BSC.ESC,
            ]);
        }

        return frame;
    };

    /**
     * Add end of text chars to frame based on use of transparent text mode and if it last block.
     *
     * @param {*} frame
     * @param {*} isLastBlock - Determines if ends with ETB or ETX
     * @param {*} useTransparentMode - If true use BSC transparent text mode
     * @returns frame
     */
    static addEndOfText(frame, isLastBlock = true, useTransparentMode = false) {

        // End block/transmission
        if ( useTransparentMode )
            frame.push(BSC.DLE);
        if ( isLastBlock )
            frame.push(BSC.ETX);
        else
            frame.push(BSC.ETB);

        return frame;
    }

    /**
     * Create a BSC frame that contains for a 3270 command stream (datastream).
     * When using transparent mode, any DLE chars should already be escaped
     *
     * @param {*} data - An array of byte values to be sent as the text block
     * @param {*} isLastBlock - Determines if ends with ETB or ETX
     * @param {*} useTransparentMode - If true use BSC transparent text mode
     * @returns The constructed BSC frame
     */
    static makeFrameCommand(data, isLastBlock = true, useTransparentMode = false) {

        let frame = BSC.createFrameWithPrefix(useTransparentMode);

        // Add the data
        frame.push(data);

        // Add the end of block / end of text to frame.
        BSC.addEndOfText(frame, isLastBlock, useTransparentMode);

        // Calculate and add the BCC chars to the frame
        this.addBccToFrame(frame);

        return frame;
    }

}

module.exports.BSC = BSC;

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

class BisyncLine {

    static telnetTerminalType = config.get("telnet.terminal-type");
    static FRAME_XMIT_RETRY_LIMIT = 3;
    static RESPONSE_TIMEOUT = 20000;

    static CMD_WRITE    = 0x01;
    static CMD_READ     = 0x02;
    static CMD_POLL     = 0x09;

    constructor() {
        this.devices = [];
        this.frameCount = 0;
    }

    addDevice(pollAddress, terminalType) {
        this.devices.push( new BisyncTerminal(pollAddress, terminalType, this ) );
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
        for ( let x=0; x<this.devices.length; x++) {
            await this.devices[x].start();
        }
    }

    async closeDevices() {
        for ( let x=0; x<this.devices.length; x++) {
            await this.devices[x].close();
        }
    }

    
    async runLoop() {
        // do until shutdown ...
        while ( this.runFlag ) {
            // For each device, send any queued data on the BSC line.
            for ( let x=0; x<this.devices.length; x++) {
                await this.devices[x].sendQueuedData();
            }

            // For each device, poll for input
            for ( let x=0; x<this.devices.length; x++) {
                await this.devices[x].pollForInput();
            }
        }
    }

    async setupSerialPort() {
        let portPath = config.get("line.serial-device");
        this.serialComms = new SerialComms(portPath);
        this.serialComms.start();
    }

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

        this.runFlag = true;
        await this.runLoop();

        await sleep(10000);

        await this.closeDevices();
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

module.exports.BisyncTerminal = BisyncTerminal;
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
