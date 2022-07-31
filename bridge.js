"use strict";

const config = require('config');
const { logMgr } = require('./logger.js');
const { crc16 } = require("crc");

const { TelnetConnection, } = require("./telnet-client");
const { hexDump } = require("./hex-dump");
const { parseIntDecOrHex } = require("./parse-int-dec-or-hex");

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

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
}

class BscFrame extends Uint8Array {
    constructor(size = 300, initialData = null)  {
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

    static makeFrameStart() {
        let frame = new BscFrame(6);
        frame.push([
            BSC.LEADING_PAD, BSC.LEADING_PAD,
            BSC.SYN, BSC.SYN,
            BSC.EOT,
            BSC.TRAILING_PAD
        ]);
        return frame;
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


    static makeFrameSelectAddress(cuAddress, devAddress) {
        let frame = new BscFrame(7);
        frame.push([
            BSC.SYN, BSC.SYN,
            cuAddress, cuAddress,
            devAddress, devAddress,
            BSC.ENQ
        ]);
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
                BSC.SYN, BSC.SYN,
                BSC.STX,
                BSC.ESC,
            ]);
        } else {
            frame.push([
                BSC.SYN, BSC.SYN,
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

    static makeFrameEnd() {
        let frame = new BscFrame(5);
        frame.push([
            BSC.LEADING_PAD,
            BSC.SYN, BSC.SYN,
            BSC.EOT,
            BSC.TRAILING_PAD
        ]);
        return frame;
    }

}

module.exports.BSC = BSC;

class BisyncLine {

    static telnetTerminalType = config.get("telnet.terminal-type");
    static FRAME_XMIT_RETRY_LIMIT = 3;

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
                terminal.type || telnetTerminalType
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

    async run() {
        this.controllerAddress = config.get("line.controller-address");
        this.serialDevice = config.get("line.serial-device");
        let terminalList = config.get("line.terminals");

        this.addDevices(terminalList);

        await this.connectDevices();

        this.runFlag = true;
        await runLoop();

        await sleep(10000);

        await this.closeDevices();
    }

    async stop() {
        this.runFlag = false;
    }

    async sendFrame(frame) {
        this.frameCount++;
    }

    async sendFrameAndGetResponse(frame) {
        let ack = false;
        let retries = 0;
        while ( !ack && retries <= BisyncLine.FRAME_XMIT_RETRY_LIMIT ) {
            await this.sendFrame(frame);
            // get response ...

            // Check for ACK/NAK
        }
        return response;
    }

    /**
     *  Send the data across the serial line, constructing BSC frames and awaiting
     *  for ACKs.
     */
    async sendData( deviceSubAddress, dataBuffer ) {
        let useDataBuffer = dataBuffer;
        if ( dataBuffer instanceof Buffer )
            useDataBUffer = Uint8Array(dataBuffer);

        // Initiate transmit
        await this.sendFrame(BSC.makeFrameTransmitStart());
        // Select
        let frame = BSC.makeFrameSelectAddress(this.controllerAddress, deviceSubAddress);
        let response = await this.sendFrameAndGetResponse(frame);


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
                response = await this.sendFrameAndGetResponse(frame);
                chunk = [];
            }
        }
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
