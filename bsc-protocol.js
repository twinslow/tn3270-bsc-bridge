/**
 * Basic BSC protocol information
 */
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
    static ESC = 0x27;

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

    static hasBscControlChar(data) {
        if ( !data )
            return false;

        for( let x=0; x<data.length; x++ ) {
            if ( BSC.BSC_CONTROL_CHECK[data[x]] )
                return true;
        }
        return false;
    }


}

class EBCDIC {
    static ESC = 0x27;
}

module.exports.BSC = BSC;
module.exports.EBCDIC = EBCDIC;
