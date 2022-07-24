"use strict";

function parseIntDecOrHex(value) {
    if (value == null || value == undefined)
        return value;

    if (typeof value == 'number')
        return value;

    let svalue = String(value).trim().toLowerCase();
    if (svalue.startsWith("0x"))
        return parseInt(svalue, 16);

    else
        return parseInt(svalue);
}

exports.parseIntDecOrHex = parseIntDecOrHex;
