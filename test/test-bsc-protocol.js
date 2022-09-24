const { BSC } = require('../bsc-protocol');

const
    sinon = require('sinon'),
    expect = require('chai').expect;

describe("Testing class BSC", function() {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test getDevicePollChar() function", function () {

        expect(BSC.getDevicePollChar(0x00)).to.be.equal(0x40);
        expect(BSC.getDevicePollChar(0x01)).to.be.equal(0xC1);
    });
    it("Test getDeviceSelectChar() function", function () {

        expect(BSC.getDeviceSelectChar(0x00)).to.be.equal(0x60);
        expect(BSC.getDeviceSelectChar(0x01)).to.be.equal(0x61);
    });
    it("Test hasBscControlChars() function", function() {

        expect(BSC.hasBscControlChar([0xD9, BSC.STX, 0x40, 0xC8, 0x40, 0x50])).to.be.true;
        expect(BSC.hasBscControlChar([0xD9, 0x20, 0x40, 0xC8, 0x40, 0x50])).to.be.false;
        expect(BSC.hasBscControlChar([0x10])).to.be.true;
        expect(BSC.hasBscControlChar([])).to.be.false;
        expect(BSC.hasBscControlChar(null)).to.be.false;

    });

});