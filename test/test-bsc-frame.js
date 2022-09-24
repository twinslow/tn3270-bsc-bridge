const { BscFrame, BscFrameCreator } = require('../bsc-frame');
const { BSC } = require('../bsc-protocol');

const
    sinon = require('sinon'),
    expect = require('chai').expect;

describe("Testing class BscFrame", function() {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test static findStartOfFrame() function", function () {

        expect( BscFrame.findStartOfFrame(
            Buffer.from( [BSC.EOT] )
        )).to.be.equal(0);

        expect(BscFrame.findStartOfFrame(
            Buffer.from([BSC.SYN, BSC.EOT])
        )).to.be.equal(0);

        expect(BscFrame.findStartOfFrame(
            Buffer.from([BSC.LEADING_PAD, BSC.SYN, BSC.EOT])
        )).to.be.equal(1);

        expect(BscFrame.findStartOfFrame(
            Buffer.from([BSC.SYN, BSC.SYN, BSC.EOT])
        )).to.be.equal(1);

        expect(BscFrame.findStartOfFrame(
            Buffer.from([BSC.SYN, BSC.EOT, BSC.SYN, BSC.TRAILING_PAD])
        )).to.be.equal(0);

    });
    it("Test static findEndOfFrame() function", function () {

        expect(BscFrame.findEndOfFrame(
            Buffer.from([BSC.EOT])
        )).to.be.equal(0);

        expect(BscFrame.findEndOfFrame(
            Buffer.from([BSC.SYN, BSC.EOT, BSC.TRAILING_PAD])
        )).to.be.equal(2);

        expect(BscFrame.findEndOfFrame(
            Buffer.from([BSC.SYN, BSC.EOT, BSC.TRAILING_PAD, BSC.TRAILING_PAD])
        )).to.be.equal(2);

        expect(BscFrame.findEndOfFrame(
            Buffer.from([BSC.SYN, BSC.EOT, BSC.TRAILING_PAD, BSC.TRAILING_PAD, BSC.TRAILING_PAD])
        )).to.be.equal(2);

        expect(BscFrame.findEndOfFrame(
            Buffer.from([BSC.SYN, BSC.EOT])
        )).to.be.equal(1);

    });
    it("Test static createFrame() function", function () {

        expect(BscFrame.createFrame(
            Buffer.from([BSC.EOT])
        )).to.be.deep.equal( new BscFrame(null, [BSC.EOT]));

        expect(BscFrame.createFrame(
            Buffer.from([BSC.SYN, BSC.EOT])
        )).to.be.deep.equal(new BscFrame(null, [BSC.SYN, BSC.EOT]));

        expect(BscFrame.createFrame(
            Buffer.from([BSC.SYN, BSC.SYN, BSC.EOT, BSC.TRAILING_PAD, BSC.TRAILING_PAD])
        )).to.be.deep.equal(new BscFrame(null, [BSC.SYN, BSC.EOT, BSC.TRAILING_PAD]));

    });

    it("Test push() function with single byte", function() {

        let obj = new BscFrame();
        expect(obj.frameSize).to.be.equal(0);

        obj.push(0x41);
        expect(obj.frameSize).to.be.equal(1);

        obj.push(0x42);
        expect(obj.frameSize).to.be.equal(2);

        expect(obj[0]).to.be.equal(0x41);
        expect(obj[1]).to.be.equal(0x42);

    });
    it("Test push() function with array", function() {

        let obj = new BscFrame();
        expect(obj.frameSize).to.be.equal(0);

        obj.push([0x41]);
        expect(obj.frameSize).to.be.equal(1);

        obj.push([0x42,0x43]);
        expect(obj.frameSize).to.be.equal(3);

        expect(obj[0]).to.be.equal(0x41);
        expect(obj[1]).to.be.equal(0x42);
        expect(obj[2]).to.be.equal(0x43);

    });
    it("Test push() function with Buffer", function() {

        let obj = new BscFrame();
        expect(obj.frameSize).to.be.equal(0);

        obj.push(Buffer.from([0x41,0x42,0x43]));
        expect(obj.frameSize).to.be.equal(3);

        expect(obj[0]).to.be.equal(0x41);
        expect(obj[1]).to.be.equal(0x42);
        expect(obj[2]).to.be.equal(0x43);

    });
    it("Test push() function with Uint8Array", function() {

        let obj = new BscFrame();
        expect(obj.frameSize).to.be.equal(0);

        obj.push(new Uint8Array([0x41,0x42,0x43]));
        expect(obj.frameSize).to.be.equal(3);

        expect(obj[0]).to.be.equal(0x41);
        expect(obj[1]).to.be.equal(0x42);
        expect(obj[2]).to.be.equal(0x43);

    });
    it("Test push() function with Int8Array", function() {

        let obj = new BscFrame();
        expect(obj.frameSize).to.be.equal(0);

        obj.push(new Int8Array([0x41,0x42,0x43]));
        expect(obj.frameSize).to.be.equal(3);

        expect(obj[0]).to.be.equal(0x41);
        expect(obj[1]).to.be.equal(0x42);
        expect(obj[2]).to.be.equal(0x43);

    });
    it("Test getFrameType() function == EOT", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.EOT, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_EOT);

        obj = new BscFrame(null, [BSC.SYN, BSC.STX, BSC.ETX, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.not.equal(BscFrame.FRAME_TYPE_EOT);

    });
    it("Test getFrameType() function == ENQ", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.ENQ, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_ENQ);

        obj = new BscFrame(null, [BSC.SYN, BSC.EOT, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.not.equal(BscFrame.FRAME_TYPE_ENQ);

    });
    it("Test getFrameType() function == ACK", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.ACK0, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_ACK);

        obj = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.ACK1, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_ACK);

        obj = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.STX, BSC.ETX, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.not.equal(BscFrame.FRAME_TYPE_ACK);

    });
    it("Test getFrameType() function == WACK", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.WACK, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_WACK);

    });
    it("Test getFrameType() function == NAK", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.NAK, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_NAK);

        obj = new BscFrame(null, [BSC.SYN, BSC.DLE, BSC.STX, BSC.ETX, BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.not.equal(BscFrame.FRAME_TYPE_NAK);

    });
    it("Test getFrameType() function == TEXT", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.SOH, 0xC1, 0xC2, BSC.STX, 0xF1, 0xF2, BSC.ETX, 0x33, 0x44,  BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_TEXT);

        obj = new BscFrame(null, [BSC.SYN,  BSC.STX, 0xF1, 0xF2, BSC.ETX, 0x33, 0x44,  BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_TEXT);


    });
    it("Test getFrameType() function == TRANSPARENT TEXT", function () {

        let obj = new BscFrame(null, [BSC.SYN, BSC.SOH, 0xC1, 0xC2,
            BSC.DLE, BSC.STX, 0xF1, 0xF2, BSC.DLE, BSC.ETX, 0x33, 0x44,  BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_TRANSPARENT_TEXT);

        obj = new BscFrame(null, [BSC.SYN,
            BSC.DLE, BSC.STX, 0xF1, 0xF2, BSC.DLE, BSC.ETX, 0x33, 0x44,  BSC.TRAILING_PAD]);
        expect(obj.getFrameType()).to.be.equal(BscFrame.FRAME_TYPE_TRANSPARENT_TEXT);

    });
    it("Test create frame and then push extra", function () {

        let obj = new BscFrame(300, [BSC.STX, 0x40, BSC.ETX]);

        expect(obj.frameSize).to.be.equal(3);

        obj.push(0x44);
        expect(obj.frameSize).to.be.equal(4);

        obj.push(0x55);
        expect(obj.frameSize).to.be.equal(5);

        expect(obj[0]).to.be.equal(BSC.STX);
        expect(obj[1]).to.be.equal(0x40);
        expect(obj[2]).to.be.equal(BSC.ETX);
        expect(obj[3]).to.be.equal(0x44);
        expect(obj[4]).to.be.equal(0x55);

    });
    it("Test findStartEndForBcc() function, STX...ETX", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.STX, 0x41, 0x42, BSC.ETX ]
        );

        let val = frame.findStartEndForBcc();

        expect(val).to.be.deep.equal({startOfCalc:3, endOfCalc:5, transparentMode: false});
    });
    it("Test findStartEndForBcc() function, STX...ITB", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.STX, 0x41, 0x42, BSC.ITB ]
        );

        let val = frame.findStartEndForBcc();

        expect(val).to.be.deep.equal({startOfCalc:3, endOfCalc:5, transparentMode: false});
    });
    it("Test findStartEndForBcc() function, DLE-STX...DLE-ETX", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.DLE, BSC.STX, 0x41, 0x42, BSC.DLE, BSC.ETX ]
        );

        let val = frame.findStartEndForBcc();

        expect(val).to.be.deep.equal({startOfCalc:4, endOfCalc:7, transparentMode: true});
    });
    it("Test findStartEndForBcc() function, DLE-STX...DLE-ETB", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.DLE, BSC.STX, 0x41, 0x42, BSC.DLE, BSC.ETB ]
        );

        let val = frame.findStartEndForBcc();

        expect(val).to.be.deep.equal({startOfCalc:4, endOfCalc:7, transparentMode: true});
    });
    it("Test findStartEndForBcc() function, SOH...DLE-STX...DLE-ETX", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SOH, 0x6C, 0xD9, BSC.STX, 0x40, 0x40, 0x40, 0x70, BSC.ETX ]
        );

        let val = frame.findStartEndForBcc();

        expect(val).to.be.deep.equal({startOfCalc:2, endOfCalc:9, transparentMode: false});
    });
    it("Test addBcc() function", function() {

        let frame1 = new BscFrame(300,
            [ BSC.SYN, BSC.SOH, 0x6C, 0xD9, BSC.STX, 0x40, 0x40, 0x40, 0x70, BSC.ETX ]
        );

        let frame = new BscFrame(300, frame1);
        frame.addBcc( frame );

        let expectedFrame = new BscFrame(300, frame1);
        expectedFrame.push(0x26);   // BCC1
        expectedFrame.push(0x88);   // BCC2

        expect(frame).to.be.deep.equal(expectedFrame);
    });
    it("Test addBcc() function", function() {

        let frame1 = new BscFrame(300,
            [ BSC.SYN, BSC.SOH, 0x6C, 0xD9, BSC.STX, 0x40, 0xC8, 0x40, 0x50, BSC.ETX ]
        );

        let frame = new BscFrame(300, frame1);
        frame.addBcc( frame );

        let expectedFrame = new BscFrame(300, frame1);
        expectedFrame.push(0x0D);   // BCC1
        expectedFrame.push(0x28);   // BCC2

        expect(frame).to.be.deep.equal(expectedFrame);
    });

});

describe("Testing class BscFrameCreator", function() {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test makeFrameSelectAddress() function", function() {

        let frame = BscFrameCreator.makeFrameSelectAddress( 0x02, 0x01 );

        expect(frame).to.be.deep.equal(new BscFrame( null, [
            BSC.SYN,
            0xE2, 0xE2,
            0xC1, 0xC1,
            BSC.ENQ
        ]));
    });
    it("Test makeFrameSelectAddress() function", function () {

        let frame = BscFrameCreator.makeFrameSelectAddress(0x01, 0x00 );

        expect(frame).to.be.deep.equal(new BscFrame(null, [
            BSC.SYN,
            0x61, 0x61,
            0x40, 0x40,
            BSC.ENQ,
        ]));
    });
    it("Test makeFramePollAddress() function", function () {

        let frame = BscFrameCreator.makeFramePollAddress(0x02, 0x01);

        expect(frame).to.be.deep.equal(new BscFrame(null, [
            BSC.SYN,
            0xC2, 0xC2,
            0xC1, 0xC1,
            BSC.ENQ,
        ]));
    });
    it("Test createFrameWithPrefix() function - transparentMode = false", function() {

        let frame = BscFrameCreator.createFrameWithPrefix(false);

        expect(frame).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.STX]));

    });
    it("Test createFrameWithPrefix() function - transparentMode = true", function() {

        let frame = BscFrameCreator.createFrameWithPrefix(true);

        expect(frame).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.DLE, BSC.STX]));

    });
    it("Test addEndOfText() function", function() {

        let frame = BscFrameCreator.addEndOfText(new BscFrame(), false, false);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.ETB]));

        frame = BscFrameCreator.addEndOfText(new BscFrame(), false, true);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.DLE, BSC.ETB]));

        frame = BscFrameCreator.addEndOfText(new BscFrame(), true, false);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.ETX]));

        frame = BscFrameCreator.addEndOfText(new BscFrame(), true, true);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.DLE, BSC.ETX]));
    });
    it("Test makeFrameCommand() isLastBlock = false, useTransparentMode = false", function() {

        let data = [0x41, 0x42, 0x43];

        let frame1 = BscFrameCreator.makeFrameCommand(data, false, false);

        expect(frame1).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.STX, 0x41, 0x42, 0x43, BSC.ETB, 0x04, 0xC2]));

    });
    it("Test makeFrameCommand() isLastBlock = true, useTransparentMode = false", function() {

        let data = [0x41, 0x42, 0x43];

        let frame1 = BscFrameCreator.makeFrameCommand(data, true, false);

        expect(frame1).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.STX, 0x41, 0x42, 0x43, BSC.ETX, 0xC5, 0x19]));
    });
    it("Test makeFrameCommand() isLastBlock = false, useTransparentMode = true", function() {

        let data = [0x41, 0x42, 0x43];

        let frame1 = BscFrameCreator.makeFrameCommand(data, false, true);

        expect(frame1).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.DLE, BSC.STX, 0x41, 0x42, 0x43, BSC.DLE, BSC.ETB, 0x04, 0xC2]));
    });
    it("Test makeFrameCommand() isLastBlock = true, useTransparentMode = true", function() {

        let data = [0x41, 0x42, 0x43];

        let frame1 = BscFrameCreator.makeFrameCommand(data, true, true);

        expect(frame1).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.DLE, BSC.STX, 0x41, 0x42, 0x43, BSC.DLE, BSC.ETX, 0xC5, 0x19]));
    });
    it("Test makeFrameEot() function", function() {
        let frame = BscFrameCreator.makeFrameEot();

        expect(frame).to.be.deep.equal(new BscFrame( null,
            [BSC.SYN, BSC.EOT]));
    });


});