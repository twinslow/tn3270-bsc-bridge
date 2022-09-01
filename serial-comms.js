const { SerialPort } = require('serialport');
const { sleep } = require("./sleep");
const { logMgr } = require('./logger');
const { hexDump } = require('./hex-dump');

class SerialCommsError extends Error {
    constructor(err) {
        super(err);
    }
}

class SerialComms {

    static CMD_WRITE = 0x01;
    static CMD_READ = 0x02;
    static CMD_POLL = 0x05;
    static CMD_DEBUG = 0x09;
    static CMD_RESET = 0x20;

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
        this.port.on('data', function (data) {
            xthis.hexDump(logMgr.debug, 'Serial-in', 0x20, data, data.length, true);
            xthis.processInboundData(data);
        });

    }

    processInboundCommand(cmd, cmdLen, data) {
        switch( cmd ) {
            case SerialComms.CMD_DEBUG:
                let msg = '';
                for (let x = 0; x < cmdLen; x++)
                    msg += String.fromCharCode(data[x]);
                logMgr.debug(`FROM ARDUINO: ${msg}`);
                break;
            case SerialComms.CMD_WRITE:
                this.receivedData.push(data);
                break;
        }
    }

    processInboundData(data) {
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
                return { data: this.receivedData.pop() };
            await sleep(eachWait);
            waitTime += eachWait;            
        }

        return { error: SerialComms.TIMEOUT }
    }

}

module.exports.SerialComms = SerialComms;
module.exports.SerialCommsError = SerialCommsError;