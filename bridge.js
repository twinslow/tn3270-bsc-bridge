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
    static PAD   = 0xFF;
    static NAK   = 0x3D;
    static ITB   = 0x1F;

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

        // Find the end, which will be ETX, or DLE-ETX
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

    static makeFrameCommand(data) {
        let frame = new BscFrame();
        frame.push([
            BSC.SYN, BSC.SYN,
            BSC.STX,
            BSC.ESC,
        ]);
        frame.push(data);
        frame.push(BSC.ETX);

        this.addBccToFrame(frame);

        return frame;
    }

    static makeFrameEnd() {
        let frame = new BscFrame(5);
        frame.push([
            BSC.LEADING_PAD,
            BSC.SYN, BSC.SYN,
            BSC.ENQ,
            BSC.TRAILING_PAD
        ]);
        return frame;
    }

    static makeFrameDataBlock(isEven, text, isLast) {
        let frame = new BscFrame();
        frame.push([
            BSC.SYN, BSC.SYN,
            BSC.STX
        ]);
        frame.push(text);
        frame.push([

        ])
        return frame;
    }
}

module.exports.BSC = BSC;

class BisyncLine {

    static telnetTerminalType = config.get("telnet.terminal-type");


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
        await this.sendFrame(frame);
        // get response ...

    }

    /**
     *  Send the data across the serial line, constructing BSC frames and awaiting
     *  for ACKs.
     */
    async sendData( deviceSubAddress, dataBuffer ) {

        // Initiate transmit
        await this.sendFrame(BSC.makeFrameTransmitStart());
        // Select
        let frame = BSC.makeFrameSelectAddress(this.controllerAddress, deviceSubAddress);
        let response = await this.sendFrameAndGetResponse(frame);

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
