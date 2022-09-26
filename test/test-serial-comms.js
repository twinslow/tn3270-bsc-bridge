const {
    SerialComms,
    SeruakCommsError
} = require('../serial-comms');

const
    sinon = require('sinon'),
    expect = require('chai').expect;

describe("Testing class SerialComms", function () {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test processInboundData() with no previous partial data", function () {

        let obj = new SerialComms();

        let stub_processInboundCommand = sandbox.stub(obj, 'processInboundCommand')
            .callsFake( () => {});

        obj.partialData = null;
        obj.processInboundData(Buffer.from([
            0x01, 0x00, 0x02, 0x41, 0x42
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.null;

        stub_processInboundCommand.resetHistory();
        expect(stub_processInboundCommand.callCount).to.be.equal(0);

        // Test with an extra byte that will be left in partialData.
        obj.partialData = null;
        obj.processInboundData(Buffer.from([
            0x01, 0x00, 0x02, 0x41, 0x42, 0x02
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.deep.equal( Buffer.from([
            0x02
        ]));

        stub_processInboundCommand.resetHistory();

        // Test with an 2 extra bytes that will be left in partialData.
        obj.partialData = null;
        obj.processInboundData(Buffer.from([
            0x01, 0x00, 0x02, 0x41, 0x42, 0x02, 0x02
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.deep.equal(Buffer.from([
            0x02, 0x02
        ]));

        stub_processInboundCommand.resetHistory();

        // Test with an 3 extra bytes that will be left in partialData.
        obj.partialData = null;
        obj.processInboundData(Buffer.from([
            0x01, 0x00, 0x02, 0x41, 0x42, 0x02, 0x00, 0x02
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.deep.equal(Buffer.from([
            0x02, 0x00, 0x02
        ]));

        stub_processInboundCommand.resetHistory();

        // Test with an 4 extra bytes that will be left in partialData.
        obj.partialData = null;
        obj.processInboundData(Buffer.from([
            0x01, 0x00, 0x02, 0x41, 0x42, 0x02, 0x00, 0x02, 0x31
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.deep.equal(Buffer.from([
            0x02, 0x00, 0x02, 0x31
        ]));

        stub_processInboundCommand.resetHistory();

        // Test with 2 complete commands in buffer
        obj.partialData = null;
        obj.processInboundData(Buffer.from([
            0x01, 0x00, 0x02, 0x41, 0x42, 0x02, 0x00, 0x02, 0x31, 0x32
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(2);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(stub_processInboundCommand.getCall(1).args).to.be.deep.equal([
            0x02, 2, Buffer.from([0x31, 0x32])
        ]);
        expect(obj.partialData).to.be.null;
    });
    it("Test processInboundData() with previous partial data", function () {

        let obj = new SerialComms();

        let stub_processInboundCommand = sandbox.stub(obj, 'processInboundCommand')
            .callsFake(() => { });

        // A single byte in the buffer for previous partial data
        obj.partialData = Buffer.from([0x01]);
        obj.processInboundData(Buffer.from([
            0x00, 0x02, 0x41, 0x42
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.null;

        stub_processInboundCommand.resetHistory();

        // 3 bytes in the buffer for previous partial data
        obj.partialData = Buffer.from([0x01, 0x00, 0x02]);
        obj.processInboundData(Buffer.from([
            0x41, 0x42
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.null;

        stub_processInboundCommand.resetHistory();

        // 3 bytes in the buffer for previous partial data and
        // an extra byte left over
        obj.partialData = Buffer.from([0x01, 0x00, 0x02]);
        obj.processInboundData(Buffer.from([
            0x41, 0x42, 0x01
        ]));

        expect(stub_processInboundCommand.callCount).to.be.equal(1);
        expect(stub_processInboundCommand.getCall(0).args).to.be.deep.equal([
            0x01, 2, Buffer.from([0x41, 0x42])
        ]);
        expect(obj.partialData).to.be.deep.equal(Buffer.from([0x01]));

        stub_processInboundCommand.resetHistory();
    });
});

