const {
    BscFrame,
    BSC
} = require('../bridge.js');

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
});

describe("Testing class BSC", function() {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test makeFrameStart() function", function() {

        let frame = BSC.makeFrameStart();

        expect(frame).to.be.deep.equal(new BscFrame( 6, [
            BSC.LEADING_PAD, BSC.LEADING_PAD,
            BSC.SYN, BSC.SYN,
            BSC.EOT,
            BSC.TRAILING_PAD
        ]));
    });
    it("Test findStartEndForBcc() function, STX...ETX", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.STX, 0x41, 0x42, BSC.ETX ]
        );

        let val = BSC.findStartEndForBcc( frame );

        expect(val).to.be.deep.equal({startOfCalc:3, endOfCalc:6, transparentMode: false});
    });
    it("Test findStartEndForBcc() function, STX...ITB", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.STX, 0x41, 0x42, BSC.ITB ]
        );

        let val = BSC.findStartEndForBcc( frame );

        expect(val).to.be.deep.equal({startOfCalc:3, endOfCalc:6, transparentMode: false});
    });
    it("Test findStartEndForBcc() function, DLE-STX...DLE-ETX", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.DLE, BSC.STX, 0x41, 0x42, BSC.DLE, BSC.ETX ]
        );

        let val = BSC.findStartEndForBcc( frame );

        expect(val).to.be.deep.equal({startOfCalc:4, endOfCalc:8, transparentMode: true});
    });
    it("Test findStartEndForBcc() function, DLE-STX...DLE-ETB", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SYN, BSC.DLE, BSC.STX, 0x41, 0x42, BSC.DLE, BSC.ETB ]
        );

        let val = BSC.findStartEndForBcc( frame );

        expect(val).to.be.deep.equal({startOfCalc:4, endOfCalc:8, transparentMode: true});
    });
    it("Test findStartEndForBcc() function, SOH...DLE-STX...DLE-ETX", function() {

        let frame = new BscFrame(300,
            [ BSC.SYN, BSC.SOH, 0x6C, 0xD9, BSC.STX, 0x40, 0x40, 0x40, 0x70, BSC.ETX ]
        );

        let val = BSC.findStartEndForBcc( frame );

        expect(val).to.be.deep.equal({startOfCalc:2, endOfCalc:10, transparentMode: false});
    });
    it("Test addBccToFrame() function", function() {

        let frame1 = new BscFrame(300,
            [ BSC.SYN, BSC.SOH, 0x6C, 0xD9, BSC.STX, 0x40, 0x40, 0x40, 0x70, BSC.ETX ]
        );

        let frame = new BscFrame(300, frame1);
        frame = BSC.addBccToFrame( frame );

        let expectedFrame = new BscFrame(300, frame1);
        expectedFrame.push(0x26);   // BCC1
        expectedFrame.push(0x88);   // BCC2

        expect(frame).to.be.deep.equal(expectedFrame);
    });
    it("Test addBccToFrame() function", function() {

        let frame1 = new BscFrame(300,
            [ BSC.SYN, BSC.SOH, 0x6C, 0xD9, BSC.STX, 0x40, 0xC8, 0x40, 0x50, BSC.ETX ]
        );

        let frame = new BscFrame(300, frame1);
        frame = BSC.addBccToFrame( frame );

        let expectedFrame = new BscFrame(300, frame1);
        expectedFrame.push(0x0D);   // BCC1
        expectedFrame.push(0x28);   // BCC2

        expect(frame).to.be.deep.equal(expectedFrame);
    });
    it("Test makeFrameSelectAddress() function", function() {

        let frame = BSC.makeFrameSelectAddress( 0xC1, 0x41 );

        expect(frame).to.be.deep.equal(new BscFrame( 7, [
            BSC.SYN, BSC.SYN,
            0xC1, 0xC1,
            0x41, 0x41,
            BSC.ENQ,
        ]));
    });
    it("Test hasBscControlChars() function", function() {

        expect(BSC.hasBscControlChar([0xD9, BSC.STX, 0x40, 0xC8, 0x40, 0x50])).to.be.true;
        expect(BSC.hasBscControlChar([0xD9, 0x20, 0x40, 0xC8, 0x40, 0x50])).to.be.false;
        expect(BSC.hasBscControlChar([0x10])).to.be.true;
        expect(BSC.hasBscControlChar([])).to.be.false;
        expect(BSC.hasBscControlChar(null)).to.be.false;

    });
    it("Test createFrameWithPrefix() function - transparentMode = false", function() {

        let frame = BSC.createFrameWithPrefix(false);

        expect(frame).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.SYN, BSC.STX, BSC.ESC]));

    });
    it("Test createFrameWithPrefix() function - transparentMode = true", function() {

        let frame = BSC.createFrameWithPrefix(true);

        expect(frame).to.be.deep.equal(new BscFrame(300,
            [BSC.SYN, BSC.SYN, BSC.DLE, BSC.STX, BSC.ESC]));

    });
    it("Test addEndOfText() function", function() {

        let frame = BSC.addEndOfText(new BscFrame(), false, false);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.ETB]));

        frame = BSC.addEndOfText(new BscFrame(), false, true);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.DLE, BSC.ETB]));

        frame = BSC.addEndOfText(new BscFrame(), true, false);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.ETX]));

        frame = BSC.addEndOfText(new BscFrame(), true, true);
        expect(frame).to.be.deep.equal(new BscFrame(300, [BSC.DLE, BSC.ETX]));
    });
    it("Test makeFrameCommand() isLastBlock = false, useTransparentMode = false", function() {

        let data = [0x41, 0x42, 0x43];

        let stub_addBccToFrame = sandbox.stub(BSC, "addBccToFrame")
            .callsFake( (frame) =>
            {
                // Add these dummy BCC chars
                frame.push( 0xF1 );
                frame.push( 0xF2 );
            });
        let stub_createFrameWithPrefix = sandbox.stub(BSC, 'createFrameWithPrefix')
            .callsFake( () => { return new BscFrame(); });
        let stub_addEndOfText = sandbox.stub(BSC, 'addEndOfText')
            .callsFake( () => {} );

        let frame1 = BSC.makeFrameCommand(data, false, false);
        expect(stub_createFrameWithPrefix.callCount).to.be.equal(1);
        expect(stub_createFrameWithPrefix.getCall(0).args).to.be.deep.equal([false]);

        expect(stub_addEndOfText.callCount).to.be.equal(1);
        expect(stub_addEndOfText.getCall(0).args.length).to.be.equal(3)
        expect(stub_addEndOfText.getCall(0).args[1]).to.be.false;
        expect(stub_addEndOfText.getCall(0).args[2]).to.be.false;

        expect(frame1).to.be.deep.equal(new BscFrame(300, [0x41, 0x42, 0x43, 0xF1, 0xF2]));
    });
    it("Test makeFrameCommand() isLastBlock = true, useTransparentMode = false", function() {

        let data = [0x41, 0x42, 0x43];

        let stub_addBccToFrame = sandbox.stub(BSC, "addBccToFrame")
            .callsFake( (frame) =>
            {
                // Add these dummy BCC chars
                frame.push( 0xF1 );
                frame.push( 0xF2 );
            });
        let stub_createFrameWithPrefix = sandbox.stub(BSC, 'createFrameWithPrefix')
            .callsFake( () => { return new BscFrame(); });
        let stub_addEndOfText = sandbox.stub(BSC, 'addEndOfText')
            .callsFake( () => {} );

        let frame1 = BSC.makeFrameCommand(data, true, false);
        expect(stub_createFrameWithPrefix.callCount).to.be.equal(1);
        expect(stub_createFrameWithPrefix.getCall(0).args).to.be.deep.equal([false]);

        expect(stub_addEndOfText.callCount).to.be.equal(1);
        expect(stub_addEndOfText.getCall(0).args.length).to.be.equal(3)
        expect(stub_addEndOfText.getCall(0).args[1]).to.be.true;
        expect(stub_addEndOfText.getCall(0).args[2]).to.be.false;

        expect(frame1).to.be.deep.equal(new BscFrame(300, [0x41, 0x42, 0x43, 0xF1, 0xF2]));
    });
    it("Test makeFrameCommand() isLastBlock = true, useTransparentMode = true", function() {

        let data = [0x41, 0x42, 0x43];

        let stub_addBccToFrame = sandbox.stub(BSC, "addBccToFrame")
            .callsFake( (frame) =>
            {
                // Add these dummy BCC chars
                frame.push( 0xF1 );
                frame.push( 0xF2 );
            });
        let stub_createFrameWithPrefix = sandbox.stub(BSC, 'createFrameWithPrefix')
            .callsFake( () => { return new BscFrame(); });
        let stub_addEndOfText = sandbox.stub(BSC, 'addEndOfText')
            .callsFake( () => {} );

        let frame1 = BSC.makeFrameCommand(data, true, true);
        expect(stub_createFrameWithPrefix.callCount).to.be.equal(1);
        expect(stub_createFrameWithPrefix.getCall(0).args).to.be.deep.equal([true]);

        expect(stub_addEndOfText.callCount).to.be.equal(1);
        expect(stub_addEndOfText.getCall(0).args.length).to.be.equal(3)
        expect(stub_addEndOfText.getCall(0).args[1]).to.be.true;
        expect(stub_addEndOfText.getCall(0).args[2]).to.be.true;

        expect(frame1).to.be.deep.equal(new BscFrame(300, [0x41, 0x42, 0x43, 0xF1, 0xF2]));
    });
    it("Test makeFrameStart() function", function() {

        let frame = BSC.makeFrameEnd();

        expect(frame).to.be.deep.equal(new BscFrame( 6, [
            BSC.LEADING_PAD, BSC.LEADING_PAD,
            BSC.SYN, BSC.SYN,
            BSC.EOT,
            BSC.TRAILING_PAD
        ]));
    });


});