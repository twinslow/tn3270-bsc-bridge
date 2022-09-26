"use strict";

const { BSC } = require('./bsc-protocol');
const { crc16 } = require("crc");
const { hexDump } = require('./hex-dump');
const { logMgr } = require('./logger.js');

/**
 * A class to contain a variable frame of data containing byte orientated data.
 */
class BscFrame extends Uint8Array {

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

        this.crcValue = 0;
        this.inTransparentText = false;
        this.autoInsertBcc = true;
    }

    push(data) {
        if ( data instanceof Array
             || data instanceof Buffer
             || data instanceof Uint8Array
             || data instanceof Int8Array
              ) {
            for ( let x = 0; x<data.length; x++ )
                this.pushByte(data[x]);
            return;
        }

        this.pushByte(data);
    }

    pushByte(dataByte) {
        this[this.frameSize++] = dataByte;
    }

    /**
     * Add the dataByte to the buffer, prefixed with a DLE char. The DLE is not
     * part of the CRC calculation. A DLE-STX sequence will reset the CRC value
     * and set the transparent mode to true.
     *
     * A DLE followed by ETB, ITB, ENQ, ETX will end transparent mode. The
     * character is added to the CRC calculation.
     *
     * @param {*} dataByte
     */
    pushEscapedDataByte(dataByte) {
        this.pushByte(BSC.DLE); // This is not included in the CRC calculation
        // Reset CRC calculation if required
        if ( dataByte === BSC.STX ) {
            this.crcValue = 0;
            this.transparentMode = true;
        }
        else {
            this.crcValue = crc16([dataByte], this.crcValue);
            if ( dataByte === BSC.ETB ||
                 dataByte === BSC.ITB ||
                 dataByte === BSC.ENQ ||
                 dataByte === BSC.ETX ) {
                this.transparentMode = false;
            }
        }

        this.pushByte(dataByte);
        if ( this.autoInsertBcc &&
             ( dataByte == BSC.ETB || dataByte == BSC.ITB || dataByte == BSC.ETX ) ) {
            let bccValue = this.crcValue;
            this.pushByte( 0x000000FF & bccValue );
            bccValue = bccValue>>8;
            this.pushByte( 0x000000FF & bccValue );
        }
    }

    /**
     * Add the dataByte to the buffer. If we are in transparent mode then
     * the byte is added to the buffer and included in the CRC. Also, if the
     * byte value is a DLE then it is prefixed with a DLE.
     *
     * If we are not in transparent mode then if the character is a SOH or STX
     * then we reset the CRC. The byte is not included in the CRC calculation.
     *
     * @param {*} dataByte
     */
    pushDataByte(dataByte) {
        // Reset CRC calculation if required
        if ( !this.transparentMode &&
             ( dataByte === BSC.SOH || dataByte === BSC.STX ) )
                this.crcValue = 0;
        else {
            this.crcValue = crc16([dataByte], this.crcValue);
        }
        if ( this.transparentMode && dataByte === BSC.DLE ) {
            this.pushByte(dataByte);    // Double the DLE
        }
        this.pushByte(dataByte);    // Add to frame buffer
        if ( this.autoInsertBcc &&
             !this.transparentMode &&
                ( dataByte == BSC.ETB || dataByte == BSC.ITB || dataByte == BSC.ETX ) ) {
            let bccValue = this.crcValue;
            this.pushByte( 0x000000FF & bccValue );
            bccValue = bccValue>>8;
            this.pushByte( 0x000000FF & bccValue );
        }
    }

    /**
     * Find the start of the frame
     *
     * @param {*} frameData - An array type object that contains the frame.
     */
    static findStartOfFrame(frameData) {
        let idx = 0;

        // Return index pos of the last sync char at the start of the frame.
        while ( idx < frameData.length - 1 ) {
            if ( frameData[idx] === BSC.LEADING_PAD ||
                 frameData[idx] === BSC.TRAILING_PAD ||
                 ( frameData[idx] === BSC.SYN && frameData[idx+1] === BSC.SYN ) )
                idx++;
            else
                break;
        }

        return idx;
    }

    /**
     * Find the end the "data in the frame"
     *
     * @param {*} frameData - An array type object that contains the frame.
     */
    static findEndOfFrame(frameData) {
        let idx = frameData.length - 1;

        // Return index position of end ... were we ignore multiple trailing pad chars.
        while ( idx > 0 ) {
            if ( frameData[idx]   === BSC.TRAILING_PAD &&
                 frameData[idx-1] === BSC.TRAILING_PAD )
                idx--;
            else
                break;
        }

        return idx;
    }

    /**
     * Create a BscFrame object with the specified data, stripping away leading pad and extra sync.
     * We should left with a standardized format which has a single leading sync and a single trailing
     * pad.
     *
     * @param {*} frameData - An array or Buffer type object that contains the frame
     */
    static createFrame(frameData) {
        if ( !(frameData instanceof Buffer) )
            frameData = Buffer.from(frameData);

        // Input data might be something like this ...
        // PAD, PAD, SYNC, SYNC, SYNC, SYNC, DLE, ACK0, PAD, SYNC, SYNC, SYNC, PAD, PAD, PAD

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
            frameData.subarray(startOfFrame, endOfFrame+1) );
    }

    // Define constants for different frame types we get as a response.
    static FRAME_TYPE_EOT       = 1;
    static FRAME_TYPE_ENQ       = 2;
    static FRAME_TYPE_ACK       = 3;
    static FRAME_TYPE_NAK       = 4;
    static FRAME_TYPE_WACK      = 5;
    static FRAME_TYPE_RVI       = 6;
    static FRAME_TYPE_POLL_SELECT = 7;
    static FRAME_TYPE_TEXT      = 9;
    static FRAME_TYPE_TRANSPARENT_TEXT = 10;
    static FRAME_TYPE_BAD       = -1;

    // Now a constant for a timeout.
    static RESPONSE_TIMEOUT     = -2;
    static RESPONSE_OTHER_ERROR = -99;

    getFrameType() {

        if ( this[1] === BSC.EOT )
            return BscFrame.FRAME_TYPE_EOT
        else if ( this[1] === BSC.ENQ )
            return BscFrame.FRAME_TYPE_ENQ;
        else if ( this[1] === BSC.ENQ )
            return BscFrame.FRAME_TYPE_ENQ;
        else if ( this[1] === BSC.DLE &&
                  this.frameSize === 4 &&
                  ( this[2] === BSC.ACK0 || this[2] === BSC.ACK1 ) )
            return BscFrame.FRAME_TYPE_ACK;
        else if ( this[1] === BSC.DLE &&
                  this.frameSize === 4 &&
                  this[2] === BSC.WACK )
            return BscFrame.FRAME_TYPE_WACK;
        else if ( this[1] === BSC.DLE &&
                  this.frameSize === 4 &&
                  this[2] === BSC.RVI )
            return BscFrame.FRAME_TYPE_RVI;
        else if ( this[1] === BSC.NAK )
            return BscFrame.FRAME_TYPE_NAK;
        else if ( this.frameSize === 7 &&
                  this[5] == BSC.ENQ )
            return BscFrame.FRAME_TYPE_POLL_SELECT;

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

    hasHeader() {
        for (let x = 0; x < this.frameSize; x++) {
            if (this[x] === BSC.SOH) {
                return true;
            }
        }
        return false;
    }

    /**
     * Execute the call back function for each byte in the text portion of the message.
     * @param {*} callBackFn
     */
    forEachTextByte( callBackFn ) {
        let inText = false;
        let transparentText = false;
        for ( let x = 0; x < this.frameSize; x++ ) {
            if ( !inText ) {
                if ( this[x] === BSC.STX ) {
                    inText = true;
                    if ( x >= 1 && this[x-1] === BSC.DLE ) {
                        transparentText = true;
                    }
                    continue;
                }
            } else {
                if ( !transparentText ) {
                    if ( this[x] === BSC.ETX || this[x] === BSC.ETB || this[x] === BSC.ITB )
                        inText = false;
                } else if ( x < this.frameSize - 1 && this[x] === BSC.DLE &&
                    ( this[x+1] === BSC.ETX || this[x+1] === BSC.ETB || this[x+1] === BSC.ITB ) ) {
                        inText = false;
                }
            }
            if ( inText ) {
                if ( transparentText ) {
                    if ( this[x] == BSC.DLE ) {
                        switch( this[x+1] ) {
                            case BSC.DLE:
                                x++;
                                break;
                            case BSC.SYN:
                                x += 2;
                                continue;
                        }
                    }
                }
                callBackFn(this[x]);
            }
        }
    }

    /**
     * Find the start and end index positions which we should use to calculate
     * the block check characters.
     */
    findStartEndForBcc() {
        let transparentMode = false;
        let startOfCalc;

        let ptr = 0;
        while( this[ptr] != BSC.STX && this[ptr] != BSC.SOH )
            ptr++;

        if ( this[ptr] == BSC.SOH ) {
            startOfCalc = ++ptr;
            while( this[ptr] != BSC.STX )
                ptr++;
            if ( this[ptr-1] == BSC.DLE )
                transparentMode = true;
        } else {
            if ( this[ptr-1] == BSC.DLE )
                transparentMode = true;
            startOfCalc = ++ptr;  // Start CRC16 calculation at the byte after the STX
        }

        // Find the end, which will be ETX|ITB|ETB, or DLE-ETX|ITB|ETB
        if ( transparentMode ) {
            while( this[ptr-1] != BSC.DLE
                && this[ptr] != BSC.ETX
                && this[ptr] != BSC.ITB
                && this[ptr] != BSC.ETB
                && ptr < this.frameSize )
                ptr++;
        } else {
            while( this[ptr] != BSC.ETX
                && this[ptr] != BSC.ITB
                && this[ptr] != BSC.ETB
                && ptr < this.frameSize )
                ptr++;
        }

        let endOfCalc = ptr;

        return { startOfCalc: startOfCalc, endOfCalc: endOfCalc, transparentMode: transparentMode };
    }

    /**
     * Calculate the block check characters and add them to the end of the frame.
     */
    addBcc() {

        let { startOfCalc, endOfCalc, transparentMode } = this.findStartEndForBcc();

        let bccValue;

        if ( transparentMode ) {
            // The CRC calc for transparent mode should not include the DLE before the ETX/ETB.
            // TODO: This is still suspect because maybe DLE/DLE inserted in the data should only be
            //       calculated as a single DLE. Maybe!
            // logMgr.error(`addBcc() - startOfCalc=${startOfCalc}, endOfCalc=${endOfCalc}`);
            let calcData = this.slice(startOfCalc, endOfCalc);
            calcData[ calcData.length - 1 ] =  this[endOfCalc];

            // hexDump(logMgr.error, "addBcc() - CRCCALC", 32, calcData, calcData.length, true);
            bccValue = crc16( calcData );
        } else {
            bccValue = crc16(this.slice(startOfCalc, endOfCalc+1) );
        }

        this.push( 0x000000FF & bccValue );
        bccValue = bccValue>>8;
        this.push( 0x000000FF & bccValue );

    }
}

class ResponseBscFrame extends BscFrame {

    constructor(initialData = null, responseStatus = null)  {
        super(null, initialData);
        this.responseStatus = responseStatus;
    }

    getResponseStatus() {
        if ( this.responseStatus )
            return this.responseStatus;

        return this.getFrameType();
    }
}

module.exports.BscFrame = BscFrame;
module.exports.ResponseBscFrame = ResponseBscFrame;

class BscFrameCreator {

/*
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

*/
    static makeFrameEot() {
        let frame = new BscFrame(null, [BSC.SYN, BSC.EOT]);
        return frame;
    }

    static makeFrameAck(ackType) {
        if ( ackType == 0 ) {
            let frame = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.ACK0]);
            return frame;
        }
        let frame = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.ACK1]);
        return frame;
    }

    /**
     * Create a poll or select frame using the provided CU and
     * terminal dev address characters.
     *
     * @param {*} cuChar
     * @param {*} devChar
     * @returns the constructed BSC frame
     */x
    static makeFramePollSelectAddress(cuChar, devChar) {
        let frame = new BscFrame(null, [
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
        let cuChar = BSC.getDevicePollChar(cuAddress);
        let devChar = BSC.getDevicePollChar(devAddress);

        let frame = this.makeFramePollSelectAddress(cuChar, devChar);
        return frame;
    }

    static createFrameWithPrefix(useTransparentMode = false) {
        let frame = new BscFrame();

        frame.push(BSC.SYN);

        // Use appropriate prefix
        if ( !useTransparentMode ) {
            frame.push([
                BSC.STX
            ]);
        } else {
            frame.push([
                BSC.DLE, BSC.STX
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

        let frame = BscFrameCreator.createFrameWithPrefix(useTransparentMode);

        // Add the data
        frame.push(data);

        // Add the end of block / end of text to frame.
        BscFrameCreator.addEndOfText(frame, isLastBlock, useTransparentMode);

        // Calculate and add the BCC chars to the frame
        frame.addBcc(frame);

        return frame;
    }

}

module.exports.BscFrameCreator = BscFrameCreator;
