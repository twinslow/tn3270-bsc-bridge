const { SerialPort } = require('serialport');

class SerialCommsError extends Error {
    constructor(err) {
        super(err)
    }
}

class SerialComms {
    constructor(serialDevice) {
        this.port = new SerialPort({
            path: serialDevice,
            baudRate: 57600
        }, function(err) {
            if ( err ) {
                throw new SerialCommsError(err);
            }
        });
    }

    sendSerial(frame) {
        this.port.write(frame, )
    }


    receiveSerial() {

    }

}

