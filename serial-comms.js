const { SerialPort } = require('serialport');
const { sleep } = require("./sleep");
const { logMgr } = require('./logger');
const { hexDump } = require('./hex-dump');

class SerialCommsError extends Error {
    constructor(err) {
        super(err)
    }
}

class SerialComms {
    static TIMEOUT = "Response timeout";

    constructor(serialDevice) {
        this.receivedData = [];
        this.port = new SerialPort({
            path: serialDevice,
            baudRate: 57600
        }, function(err) {
            if ( err ) {
                throw new SerialCommsError(err);
            }
        });
        let xthis = this;
        this.port.on('data', function(data) {
            hexDump(logMgr.debug, 'Serial-in', 0x20, data, data.length, true);
            xthis.receivedData.push(data);
        });
    }

    sendSerial(frame) {
        hexDump(logMgr.debug, 'Serial-out', 0x20, frame, frame.frameSize, true);
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