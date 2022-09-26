const { SerialPort } = require('serialport');
const { sleep } = require("./sleep");
const { logMgr } = require('./logger');
const { hexDump } = require('./hex-dump');

class SerialCommsError extends Error {
    constructor(err) {
        super(err);
    }
}

class SerialResponse {
    constructor(commandCode, responseCode, data) {
        this.commandCode = commandCode;
        this.responseCode = responseCode;
        this.data = data;
    }

    debugLog() {
        logMgr.debug(`SerialResponse: Command code=${this.commandCode}, response=${this.responseCode}, data-length=${this.data ? this.data.length : 0}`);
        if ( this.data )
            hexDump(logMgr.debug, `SerialResponse: `, 0x20, this.data, this.data.length, true);
    }
}

class SerialComms {

    static CMD_WRITE = 0x01;
    static CMD_READ = 0x02;
    static CMD_WRITE_READ = 0x03;
    static CMD_DEBUG = 0x09;
    static CMD_FREEMEM = 0x0c;
    static CMD_RESET = 0x0F;
    static CMD_CODE_MASK = 0x0F;
    static CMD_ERROR_MASK = 0x70;

    static CMD_RESPONSE_OK        = 0x00;
    static CMD_RESPONSE_TIMEOUT   = 0x10;
    static CMD_RESPONSE_RESERVED2 = 0x20;
    static CMD_RESPONSE_RESERVED3 = 0x30;
    static CMD_RESPONSE_RESERVED4 = 0x40;
    static CMD_RESPONSE_RESERVED5 = 0x50;
    static CMD_RESPONSE_RESERVED6 = 0x60;
    static CMD_RESPONSE_RESERVED7 = 0x70;

    static TIMEOUT = "Response timeout";

    constructor(serialDevice) {
        this.partialData = null;
        this.receivedData = [];
        this.serialDevice = serialDevice;
    }

    hexDump(fn, prefix, fmtLen, data, dataLen, isEbcdic = true) {
        hexDump(fn, prefix, fmtLen, data, dataLen, isEbcdic);
    }

    start() {
        this.port = new SerialPort({
            path: this.serialDevice,
            baudRate: 57600
        }, function (err) {
            if (err) {
                throw new SerialCommsError(err);
            }
        });
        let xthis = this;
        this.previousDataReceived = Date.now();
        this.port.on('data', function (data) {
            // xthis.hexDump(logMgr.debug, 'Serial-in', 0x20, data, data.length, true);
            xthis.processInboundData(data);
            xthis.previousDataReceived = Date.now();

        });


    }

    processInboundCommand(cmd, cmdLen, data) {
        // logMgr.debug(`${this.constructor.name}.processInboundCommand() - Got cmd=${cmd}, cmdLen=${cmdLen}`);
        switch( cmd & SerialComms.CMD_CODE_MASK ) {
            case SerialComms.CMD_DEBUG:
                let msg = '';
                for (let x = 0; x < cmdLen; x++)
                    msg += String.fromCharCode(data[x]);
                logMgr.debug(`USB-BSC-DONGLE DEBUG: ${msg}`);
                break;

            case SerialComms.CMD_FREEMEM:
                let freeMem = 256 * data[0] + data[1];
                logMgr.info(`USB-BSC-DONGLE: Device reports free memory of ${freeMem} bytes`);
                break;

            case SerialComms.CMD_RESET:
            case SerialComms.CMD_WRITE:
            case SerialComms.CMD_WRITE_READ:
            case SerialComms.CMD_READ:
                this.receivedData.push(
                    new SerialResponse(
                        cmd & SerialComms.CMD_CODE_MASK,
                        cmd & SerialComms.CMD_ERROR_MASK,
                        data)
                );
                break;
        }
    }

    processInboundData(data) {
        // logMgr.debug(`${this.constructor.name}.processInboundData() - data.length=${data.length}}`);

        // If more than 3 seconds from previously received data then ignore previous partial data
        // as it is likely to be junk received from device.
        // if ( Date.now() - this.previousDataReceived > 1000 )
        //     this.partialData = null;

        if ( this.partialData ) {
            data = Buffer.concat([this.partialData, data]);
            this.partialData = null;
        }

        let ptr = 0;
        while ( ptr < data.length ) {
            if ( ptr + 3 <= data.length ) {
                let cmd = data[ptr];
                let cmdLen = data[ptr + 1]*256 + data[ptr + 2];
                if ( ptr + 3 + cmdLen <= data.length ) {
                    let cmdData = data.slice(ptr + 3, ptr + 3 + cmdLen);
                    this.processInboundCommand(cmd, cmdLen, cmdData);
                    ptr += 3 + cmdLen;
                } else {
                    // partial data in buffer. Save it and stop processing
                    this.partialData = data.slice(ptr);
                    break;
                }
            } else {
                // partial data in buffer. Save it and stop processing
                this.partialData = data.slice(ptr);
                break;
            }
        }
    }

    sendCommand(command, dataSize = 0) {
        let cmd = Buffer.from([command, 0, 0]);
        cmd[1] = (dataSize >> 8) & 0xFF;
        cmd[2] = dataSize & 0xFF;
        hexDump(logMgr.debug, 'Command-out', 0x20, cmd, 3, false);
        this.port.write(cmd);
    }


    sendSerial(frame) {
        let outputSize = frame.frameSize || frame.length;
        hexDump(logMgr.debug, 'Serial-data-out', 0x20, frame, outputSize, true);
        this.port.write(frame);
    }

    async receiveSerial(timeout) {
        let waitTime = 0;
        const eachWait = 5;

        while ( waitTime < timeout ) {
            if (this.receivedData.length > 0)
                return { data: this.receivedData.pop().data };
            await sleep(eachWait);
            waitTime += eachWait;
        }

        return { error: SerialComms.TIMEOUT }
    }

    /**
     * Send a BSC data frame and get the response.
     *
     * @param {*} command
     * @param {*} frame
     */
    async sendFrameAndGetResponse(frame, timeout = 4000, command = SerialComms.CMD_WRITE_READ) {
        let outputSize = frame.frameSize || frame.length;
        this.sendCommand(command, outputSize);
        this.sendSerial(frame);

        let waitTime = 0;
        const eachWait = 5;

        while ( waitTime < timeout ) {
            if (this.receivedData.length > 0) {
                let resp = this.receivedData.pop();
                resp.debugLog();
                return resp;
            }
            await sleep(eachWait);
            waitTime += eachWait;
        }

        let resp = new SerialResponse(command, 100 + SerialComms.CMD_RESPONSE_TIMEOUT);
        resp.debugLog();
        return resp;
    }
}

module.exports.SerialComms = SerialComms;
module.exports.SerialCommsError = SerialCommsError;
module.exports.SerialResponse = SerialResponse;