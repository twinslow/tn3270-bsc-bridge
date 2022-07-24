"use strict";

function hexDump(fn, linePrefix, bytesPerLine, data, length, isEbcdic) {
    for (let x = 0; x < length; x += bytesPerLine) {
        let hexPart = '';
        for (let lx = x; lx < Math.min(x + bytesPerLine, length); lx++) {
            let val = data[lx];
            if (val < 16)
                hexPart += 0 + val.toString(16);

            else
                hexPart += val.toString(16);
        }
        fn(`${linePrefix} 0x${x.toString(16).padStart(4, '0')} - ${hexPart}`);
    }
}
exports.hexDump = hexDump;
