"use strict"

const {logMgr} = require('./logger');
const {hexDump} = require('./hex-dump');

const Net = require('net');

class TelnetOption {
    static CMD_IAC     = 0xFF;
    static CMD_WILL = 0xfb;
    static CMD_WONT = 0xfc;
    static CMD_DO   = 0xfd;
    static CMD_DONT = 0xfe;

    static OPTION_BINARY            = 0;
    static OPTION_EOR               = 25;
    static OPTION_TERMINAL_TYPE     = 24;

    // Not a real option, used to handle "other".
    static OPTION_OTHER             = 0xFFFF;

    static DESC_OPTION_BINARY        = "BINARY";
    static DESC_OPTION_EOR           = "EOR";
    static DESC_OPTION_TERMINAL_TYPE = "TERMINAL_TYPE";
    static DESC_OPTION_OTHER         = "UNSUPPORTED_";

    static STATE_UNKNOWN    = -1;
    static STATE_DISABLED   = 0;
    static STATE_ENABLED    = 1;

/*
This is a table of actions to be taken when a
command is received from the server, depending on
current state and desired state.

The table should be interpreted like this ...

IF the command received is ccc
    AND the desired state is ddd
    THEN
        send the command sss
        transition the current state as/if indicated
        transition the desired state as/if indicated
END-IF

We might have to transition the desired state, because a "WONT"/"DONT"
request/ack from the remote must always be honored, even if we locally
have a desired state of enabled.

Received    Current-State   Desired-State  Send
----------- -------------   -------------  ------------
WILL        -1 --> 0        0              DONT
WILL        0               0              DONT
WILL        1 --> 0         0              DONT

WILL        -1 --> 1        1              DO
WILL        0 --> 1         1              DO
WILL        1               1              DO

WONT        -1 --> 0        0              DONT
WONT        0               0              --
WONT        1 --> 0         0              DONT

WONT        -1 --> 0        1 --> 0        DONT
WONT        0               1 --> 0        DONT
WONT        1 --> 0         1 --> 0        DONT

DO          -1 --> 0        0              WONT
DO          0               0              WONT
DO          1 --> 0         0              WONT

DO          -1 --> 1        1              WILL
DO          0 --> 1         1              WILL
DO          1               1              --

DONT        -1 --> 0        0              WONT
DONT        0               0              --
DONT        1 --> 0         0              WONT

DONT        -1 --> 0        1 --> 0        WONT
DONT        0               1 --> 0        WONT
DONT        1 --> 0         1 --> 0        WONT

*/

    constructor(optionCode,
                optionName,
                desiredState /* STATE_DISABLED or STATE_ENABLED */) {
        this.optionCode = optionCode;
        this.optionName = optionName;
        this.optionState = this.constructor.STATE_UNKNOWN;
        this.desiredState = desiredState;
    }

    setDesiredState(desiredState, socket) {
        // If no state change then nothing to negotiate.
        if ( desiredState == this.desiredState )
            return;

        // State has changed.
        if ( desiredState == TelnetOption.STATE_ENABLED ) {
            this.sendWill(socket);
        } else {
            this.sendWont(socket);
        }
        this.desiredState = desiredState;
    }

    receivedWill(socket) {
        logMgr.debug('Received WILL ' + this.optionName);
        if ( this.desiredState == TelnetOption.STATE_DISABLED ) {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendDont(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    this.sendDont(socket);
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendDont(socket);
                    break;

            }
        } else /* desiredState == STATE_ENABLED */ {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_ENABLED;
                    this.sendDo(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    this.optionState = TelnetOption.STATE_ENABLED;
                    this.sendDo(socket);
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.sendDo(socket);
                    break;
            }
        }
    }

    receivedWont(socket) {
        logMgr.debug('Received WONT ' + this.optionName);
        if ( this.desiredState == TelnetOption.STATE_DISABLED ) {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendDont(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendDont(socket);
                    break;

            }
        } else /* desiredState == STATE_ENABLED */ {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendDont(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    this.sendDont(socket);
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendDont(socket);
                    break;
            }
            this.desiredState = TelnetOption.STATE_DISABLED;
        }
    }

    receivedDo(socket) {
        logMgr.debug('Received DO ' + this.optionName);
        if ( this.desiredState == TelnetOption.STATE_DISABLED ) {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendWont(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    this.sendWont(socket);
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendWont(socket);
                    break;

            }
        } else /* desiredState == STATE_ENABLED */ {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_ENABLED;
                    this.sendWill(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    this.optionState = TelnetOption.STATE_ENABLED;
                    this.sendWill(socket);
                    break;

                case TelnetOption.STATE_ENABLED:
                    break;
            }
        }
    }

    receivedDont(socket) {
        logMgr.debug('Received DONT ' + this.optionName);
        if ( this.desiredState == TelnetOption.STATE_DISABLED ) {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendWont(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendWont(socket);
                    break;
            }
        } else /* desiredState == STATE_ENABLED */ {
            switch(this.optionState) {
                case TelnetOption.STATE_UNKNOWN:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendWont(socket);
                    break;

                case TelnetOption.STATE_DISABLED:
                    this.sendWont(socket);
                    break;

                case TelnetOption.STATE_ENABLED:
                    this.optionState = TelnetOption.STATE_DISABLED;
                    this.sendWont(socket);
                    break;
            }
            this.desiredState = TelnetOption.STATE_DISABLED;
        }
    }

    socketWrite(socket, buffer) {
        logMgr.debug('Writing to socket...');
        hexDump(logMgr.debug, 'telnet >', 0x20, buffer, buffer.length, true);
        socket.write(buffer);
    }

    sendWill(socket) {
        let sendBuff = new Uint8Array(3);

        sendBuff[0] = TelnetOption.CMD_IAC;
        sendBuff[1] = TelnetOption.CMD_WILL;
        sendBuff[2] = this.optionCode;

        this.socketWrite(socket, sendBuff);
    }

    sendWont(socket) {
        let sendBuff = new Uint8Array(3);

        sendBuff[0] = TelnetOption.CMD_IAC;
        sendBuff[1] = TelnetOption.CMD_WONT;
        sendBuff[2] = this.optionCode;
        this.socketWrite(socket, sendBuff);
    }

    sendDo(socket) {
        let sendBuff = new Uint8Array(3);

        sendBuff[0] = TelnetOption.CMD_IAC;
        sendBuff[1] = TelnetOption.CMD_DO;
        sendBuff[2] = this.optionCode;
        this.socketWrite(socket, sendBuff);
    }

    sendDont(socket) {
        let sendBuff = new Uint8Array(3);

        sendBuff[0] = TelnetOption.CMD_IAC;
        sendBuff[1] = TelnetOption.CMD_DONT;
        sendBuff[2] = this.optionCode;
        this.socketWrite(socket, sendBuff);
    }
}

class TelnetOptionSet {
    constructor() {
        this.options = [];
    }

    addOption(optionCode, optionDescription, desiredState) {
        let telnetOption = new TelnetOption(optionCode, optionDescription, desiredState);
        this.options.push(telnetOption);
        return telnetOption;
    }

    setTn3270Options() {
        this.addOption(
            TelnetOption.OPTION_BINARY,
            TelnetOption.DESC_OPTION_BINARY,
            TelnetOption.STATE_ENABLED );
        this.addOption(
            TelnetOption.OPTION_EOR,
            TelnetOption.DESC_OPTION_EOR,
            TelnetOption.STATE_ENABLED );
        this.addOption(
            TelnetOption.OPTION_TERMINAL_TYPE,
            TelnetOption.DESC_OPTION_TERMINAL_TYPE,
            TelnetOption.STATE_ENABLED );
    }

    getOptionInstance(optionCode) {
        let instance = this.options.find( (to) => to.optionCode == optionCode );
        if ( !instance ) {
            // Dynamically create an instance for the option-code.
            // This happens if we receive a WILL or WONT for an option
            // we don't expect. We will send back a DONT.
            instance = this.addOption(
                optionCode,
                TelnetOption.DESC_OPTION_OTHER + optionCode,
                TelnetOption.STATE_DISABLED );
        }
        return instance;
    }

    receiveCommand(commandCode, optionCode, socket) {
        let instance = this.getOptionInstance(optionCode);
        switch ( commandCode ) {
            case TelnetOption.CMD_WILL:
                instance.receivedWill(socket);
                break;
            case TelnetOption.CMD_WONT:
                instance.receivedWont(socket);
                break;
            case TelnetOption.CMD_DO:
                instance.receivedDo(socket);
                break;
            case TelnetOption.CMD_DONT:
                instance.receivedDont(socket);
                break;
            default:
                return false; // Command not handled;
        }
        return true;    // Command handled.
    }

    setDesiredState(optionCode, desiredState, socket) {
        let instance = this.getOptionInstance(optionCode);
        instance.setDesiredState(desiredState, socket);
    }
}

class TelnetConnection {

    static CMD_IAC  = 0xff;

    static CMD_EOR  = 0xef;
    static CMD_GA   = 0xf9;
    static CMD_SB   = 0xfa;
    static CMD_SE   = 0xf0;
    static CMD_WILL = TelnetOption.CMD_WILL;
    static CMD_WONT = TelnetOption.CMD_WONT;
    static CMD_DO   = TelnetOption.CMD_DO;
    static CMD_DONT = TelnetOption.CMD_DONT;

    static TERMINAL_DATA_BUFFER_LENGTH = 8192;

    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = new Net.Socket();
        this.isOpen = false;
        this.receivedDataSaved = [];
        this.terminalType = 'IBM-3279-4-E';
//        this.terminalType = 'IBM-3279-2';

        this.telnetOptionSet = new TelnetOptionSet();
        this.telnetOptionSet.setTn3270Options();

        this.setupTerminalReceivedDatabuffer();
    }

    socketWrite(data) {
        logMgr.debug(`${this.constructor.name}.socketWrite() - Writing to socket...`);
        hexDump(logMgr.debug, 'telnet >', 0x20, data, data.length, true);
        this.socket.write(data);
    }

    sendTerminalType() {
        let sendBuff = new Uint8Array(6 + this.terminalType.length);

        sendBuff[0] = TelnetConnection.CMD_IAC;
        sendBuff[1] = TelnetConnection.CMD_SB;
        sendBuff[2] = 0x18;
        sendBuff[3] = 0x00;
        let i = 0;
        for ( ; i < this.terminalType.length; i++ )
            sendBuff[4+i] = this.terminalType.charCodeAt(i);

        i += 4;
        sendBuff[i++] = TelnetConnection.CMD_IAC;
        sendBuff[i] = TelnetConnection.CMD_SE;
        logMgr.debug(`Sending IAC SB 0x18 0x00 ${this.terminalType} IAC SE`);
        this.socketWrite(sendBuff);
    }

    executeCommandSB(commandBuffer, idx, length) {
        let sbCode = commandBuffer[idx + 2];
        if ( sbCode == 0x18 && commandBuffer[idx + 3] == 0x01 ) {
            this.sendTerminalType();
        }
    }

    executeNegotiationCommand(commandCode, optionCode) {
        // logMgr.debug(`Debug: Got commandCode ${commandCode}, optionCode ${optionCode}`);
        this.telnetOptionSet.receiveCommand(commandCode, optionCode, this.socket);
    }

    executeReceivedCommand(commandBuffer, idx) {
        let commandCode = commandBuffer[idx+1];
        switch ( commandCode ) {
            case TelnetConnection.CMD_SB:
                // logMgr.debug(`Debug: Got command SB ${commandBuffer.readUint8(idx+1)}`);
                let commandLength;
                // Find the end of the command
                for ( let endIdx = idx + 2; endIdx < commandBuffer.length - 1; endIdx ++) {
                    if ( commandBuffer[endIdx] == TelnetConnection.CMD_IAC &&
                          commandBuffer[endIdx+1] == TelnetConnection.CMD_SE ) {
                        commandLength = endIdx + 2 - idx;
                    }
                }
                let subordinateOption = commandBuffer[idx+2];
                // logMgr.debug(`Debug: Got SB suboption code ${subordinateOption}, command length ${commandLength}.`);
                this.executeCommandSB(commandBuffer, idx, commandLength)
                return commandLength;

            case TelnetConnection.CMD_SE:
                // logMgr.debug(`Debug: Got command SE ${commandBuffer.readUint8(idx+1)}`);
                return 2;

            case TelnetConnection.CMD_WILL:
            case TelnetConnection.CMD_DO:
            case TelnetConnection.CMD_WONT:
            case TelnetConnection.CMD_DONT:
                let optionCode = commandBuffer.readUint8(idx+2);
                this.executeNegotiationCommand(commandCode, optionCode);
                return 3;

            case TelnetConnection.CMD_EOR:
                // END-OF-RECORD received. Send the content of the terminalDataBuffer onto the
                // terminal handler.
                logMgr.debug(`Received CMD_EOR`);
                this.forwardTerminalReceivedDataBuffer(this.terminalReceivedDataBuffer);
                return 2;

            default:
                console.warn(`Error: Unrecognized commandCode ${commandCode}`);
                return 3;
        }
    }

    /**
     *
     */
    setupTerminalReceivedDatabuffer() {
        this.terminalReceivedDataBuffer = new Uint8Array(TelnetConnection.TERMINAL_DATA_BUFFER_LENGTH);
        this.terminalReceivedDataBuffer.usedLength = 0;
    }

    setupTerminalSendDataBuffer() {
        this.terminalSendDataBuffer = new Uint8Array(TelnetConnection.TERMINAL_DATA_BUFFER_LENGTH);
        this.terminalSendDataBuffer.usedLength = 0;
    }

    /**
     * Data is received by the socket and sent to this method to execute imbedded telnet commands/messages.
     * Other data, destined for the terminal is saved into the terminalDataBuffer.
     *
     * @param {*} data
     */
    receivedData(data) {
        let useBuffer = data;
        if ( useBuffer instanceof String )
            useBuffer = Buffer.from(data);

        for ( let idx = 0; idx < useBuffer.length; idx++ ) {
            if ( idx + 1 <= useBuffer.length &&
                useBuffer[idx] == 0xFF &&
                useBuffer[idx+1] != 0xFF ) {
                let sizeOfCommand = this.executeReceivedCommand(useBuffer, idx);
                // Note that if the received command was an EOR, then terminalDataBuffer will
                // be sent to the terminal handler and the a new terminalDataBuffer will be started.
                // We will continue to pull data from the socket data-buffer and process commands and feed
                // into the terminal data buffer.
                idx += sizeOfCommand - 1;
            } else if ( idx + 1 <= useBuffer.length &&
                useBuffer[idx] == 0xFF &&
                useBuffer[idx+1] == 0xFF ) {
                this.terminalReceivedDataBuffer[this.terminalReceivedDataBuffer.usedLength] = 0xFF;
                idx++;
                this.terminalReceivedDataBuffer.usedLength++;
            } else {
                this.terminalReceivedDataBuffer[this.terminalReceivedDataBuffer.usedLength] = useBuffer[idx];
                this.terminalReceivedDataBuffer.usedLength++;
            }
        }
    }

    /**
     * Sends the contents of the terminal buffer to the terminal handler.
     */
    forwardTerminalReceivedDataBuffer() {
        // Forward ...
        this.registeredDataReceiver(
            this.terminalReceivedDataBuffer.slice(0, this.terminalReceivedDataBuffer.usedLength));

        // New buffer...
        this.setupTerminalReceivedDatabuffer();
    }

    registerDataReceiver(fn) {
        this.registeredDataReceiver = fn;
    }
    /**
     *
     * @returns
     */
    connect() {
        let xthis = this;
        return new Promise((resolve, reject) => {
            xthis.socket.connect(xthis.port, xthis.host, () => {
                logMgr.info(`Client connected to telnet server ${xthis.host+':'+xthis.port}`);
                xthis.isOpen = true;
                xthis.socket.on('data', (data) => {
                    xthis.receivedData(data);
                });
                resolve();
            });
        });
    }


    sendData(message) {
        let xthis = this;
        return new Promise((resolve, reject) => {
            logMgr.debug(`Sending: ${message}`);
            xthis.socket.write(message);
            xthis.socket.on('data', (data) => {
                logMgr.debug(data);
                resolve(data);
            })

            xthis.socket.on('error', (err) => {
                reject(err);
            });
        });
    }

    close() {
        this.socket.destroy();
        logMgr.debug(`Client socket is now closed`);
        this.isOpen = false;
    }
}

module.exports.TelnetOption = TelnetOption;
module.exports.TelnetOptionSet = TelnetOptionSet;
module.exports.TelnetConnection = TelnetConnection;


