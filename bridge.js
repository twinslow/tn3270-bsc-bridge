"use strict";

const config = require('config');
const { logMgr } = require('./logger.js');

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
    constructor(size = 300)  {
        super(size);
        this.frameSize = 0;
    }

    push(data) {
        if ( typeof data == 'array' ) {
            for ( let x = 0; x<data.length; x++ )
                this[this.frameSize++] = data[x];
            return;
        }

        this[this.frameSize++] = data;
    }
}

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

    static makeFrameTransmitStart() {
        let frame = new BscFrame(5);
        frame.push([
            BSC.LEADING_PAD,
            BSC.SYN, BSC.SYN,
            BSC.ENQ,
            BSC.TRAILING_PAD
        ]);
        return frame;
    }
}

class BisyncLine {

    static telnetTerminalType = config.get("telnet.terminal-type");


    constructor() {
        this.devices = [];
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

    async sendFrameAndGetResponse(frame) {

    }

    /**
     *  Send the data across the serial line, constructing BSC frames and awaiting
     *  for ACKs.
     */
    async sendData( deviceSubAddress, dataBuffer ) {
        let frame = BSC.makeFrameTransmitStart();
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
