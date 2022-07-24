
const {
    BisyncTerminal,
    BisyncLine
} = require('../bridge.js');

const { TelnetConnection } = require('../telnet-client');

const
    sinon = require('sinon'),
    expect = require('chai').expect;

describe("Testing class BisyncTerminal", function() {

    let sandbox;
    let dummyLine = {};
    let stub_TelnetConnection_registerDataReceiver,
        stub_TelnetConnection_connect,
        stub_TelnetConnection_close;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        stub_TelnetConnection_registerDataReceiver = sandbox.stub(
            TelnetConnection.prototype, 'registerDataReceiver')
            .callsFake( () => {} );
        stub_TelnetConnection_connect = sandbox.stub(
            TelnetConnection.prototype, 'connect')
            .callsFake( () => {} );
        stub_TelnetConnection_close = sandbox.stub(
            TelnetConnection.prototype, 'close')
            .callsFake( () => {} );
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test constructor()", function() {
        let obj = new BisyncTerminal("0x41", "ut-terminal", dummyLine);

        expect(obj.pollAddress).to.be.equal(65);
        expect(obj.bisyncLine).to.be.equal(dummyLine);
        expect(obj.terminalType).to.be.equal('ut-terminal');
    });
    it("Test startt() function", async function() {
        BisyncTerminal.telnetHost = 'ut-host';
        BisyncTerminal.telnetPort = 1234;

        let obj = new BisyncTerminal("0x41", "ut-terminal", dummyLine);

        await obj.start();

        expect(obj.telnetClient).to.be.instanceof(TelnetConnection);
        expect(obj.telnetClient.host).to.be.equal("ut-host");
        expect(obj.telnetClient.port).to.be.equal(1234);
        expect(obj.telnetClient.terminalType).to.be.equal('ut-terminal');

        expect(stub_TelnetConnection_registerDataReceiver.callCount).to.be.equal(1);
        expect(stub_TelnetConnection_connect.callCount).to.be.equal(1);

    });
    it("Test close() function", async function() {
        BisyncTerminal.telnetHost = 'ut-host';
        BisyncTerminal.telnetPort = 1234;

        let obj = new BisyncTerminal("0x41", "ut-terminal", dummyLine);

        await obj.close();

        expect(stub_TelnetConnection_close.callCount).to.be.equal(1);
    });



});