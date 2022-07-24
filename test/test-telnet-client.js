const {
    TelnetOption,
    TelnetOptionSet,
    TelnetConnection } = require('../telnet-client');

const Net = require('net');

const
    sinon = require('sinon'),
    expect = require('chai').expect;

describe("Testing class TelnetOption", function() {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test constructor()", function() {
        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);

        expect(obj.optionCode).to.be.equal(0x44);
        expect(obj.optionName).to.be.equal('unit-test');
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_ENABLED);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_UNKNOWN);
    });
    it("Test setDesiredState() function disabled->enabled", function() {

        let stub_sendWill = sandbox.stub(TelnetOption.prototype, 'sendWill')
            .callsFake( () => {} );
        let stub_sendWont = sandbox.stub(TelnetOption.prototype, 'sendWont')
            .callsFake( () => {} );

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_DISABLED);

        let dummySocket = {}
        obj.setDesiredState(TelnetOption.STATE_ENABLED, dummySocket);1

        expect(stub_sendWill.callCount).to.be.equal(1);
        expect(stub_sendWont.callCount).to.be.equal(0);

        expect(stub_sendWill.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_ENABLED);
    });
    it("Test setDesiredState() function enabled->disabled", function() {

        let stub_sendWill = sandbox.stub(TelnetOption.prototype, 'sendWill')
            .callsFake( () => {} );
        let stub_sendWont = sandbox.stub(TelnetOption.prototype, 'sendWont')
            .callsFake( () => {} );

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);

        let dummySocket = {}
        obj.setDesiredState(TelnetOption.STATE_DISABLED, dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);

        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

    });
    it("Test receivedWill() function", function() {

        let stub_sendDo = sandbox.stub(TelnetOption.prototype, 'sendDo')
            .callsFake( () => {} );
        let stub_sendDont = sandbox.stub(TelnetOption.prototype, 'sendDont')
            .callsFake( () => {} );
        let dummySocket = {}

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedWill(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedWill(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedWill(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedWill(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(1);
        expect(stub_sendDont.callCount).to.be.equal(0);
        expect(stub_sendDo.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_ENABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedWill(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(1);
        expect(stub_sendDont.callCount).to.be.equal(0);
        expect(stub_sendDo.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_ENABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedWill(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(1);
        expect(stub_sendDont.callCount).to.be.equal(0);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_ENABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

    });
    it("Test receivedWont() function", function() {

        let stub_sendDo = sandbox.stub(TelnetOption.prototype, 'sendDo')
            .callsFake( () => {} );
        let stub_sendDont = sandbox.stub(TelnetOption.prototype, 'sendDont')
            .callsFake( () => {} );
        let dummySocket = {}

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedWont(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedWont(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(0);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedWont(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedWont(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedWont(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedWont(dummySocket);

        expect(stub_sendDo.callCount).to.be.equal(0);
        expect(stub_sendDont.callCount).to.be.equal(1);
        expect(stub_sendDont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendDo.resetHistory();
        stub_sendDont.resetHistory();

    });
    it("Test receivedDo() function", function() {

        let stub_sendWill = sandbox.stub(TelnetOption.prototype, 'sendWill')
            .callsFake( () => {} );
        let stub_sendWont = sandbox.stub(TelnetOption.prototype, 'sendWont')
            .callsFake( () => {} );
        let dummySocket = {}

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedDo(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedDo(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedDo(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedDo(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(1);
        expect(stub_sendWont.callCount).to.be.equal(0);
        expect(stub_sendWill.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_ENABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedDo(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(1);
        expect(stub_sendWont.callCount).to.be.equal(0);
        expect(stub_sendWill.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_ENABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedDo(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(0);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_ENABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

    });
    it("Test receivedDont() function", function() {

        let stub_sendWill = sandbox.stub(TelnetOption.prototype, 'sendWill')
            .callsFake( () => {} );
        let stub_sendWont = sandbox.stub(TelnetOption.prototype, 'sendWont')
            .callsFake( () => {} );
        let dummySocket = {}

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedDont(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedDont(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(0);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_DISABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedDont(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_UNKNOWN;
        obj.receivedDont(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_DISABLED;
        obj.receivedDont(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

        obj.desiredState = TelnetOption.STATE_ENABLED;
        obj.optionState = TelnetOption.STATE_ENABLED;
        obj.receivedDont(dummySocket);

        expect(stub_sendWill.callCount).to.be.equal(0);
        expect(stub_sendWont.callCount).to.be.equal(1);
        expect(stub_sendWont.getCall(0).args).to.be.deep.equal([dummySocket]);
        expect(obj.optionState).to.be.equal(TelnetOption.STATE_DISABLED);
        expect(obj.desiredState).to.be.equal(TelnetOption.STATE_DISABLED);

        stub_sendWill.resetHistory();
        stub_sendWont.resetHistory();

    });
    it("Test sendWill() function", function() {
        let dummySocket = {write: function(data) {}};
        let mockSocket = sandbox.mock(dummySocket);
        let willData = new Uint8Array([
            TelnetOption.CMD_IAC,
            TelnetOption.CMD_WILL,
            0x44
        ]);
        mockSocket.expects("write").withArgs(willData);

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);
        obj.sendWill(dummySocket);

        mockSocket.verify();
    });
    it("Test sendWont() function", function() {
        let dummySocket = {write: function(data) {}};
        let mockSocket = sandbox.mock(dummySocket);
        let cmdData = new Uint8Array([
            TelnetOption.CMD_IAC,
            TelnetOption.CMD_WONT,
            0x44
        ]);
        mockSocket.expects("write").withArgs(cmdData);

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);
        obj.sendWont(dummySocket);

        mockSocket.verify();
    });
    it("Test sendDo() function", function() {
        let dummySocket = {write: function(data) {}};
        let mockSocket = sandbox.mock(dummySocket);
        let cmdData = new Uint8Array([
            TelnetOption.CMD_IAC,
            TelnetOption.CMD_DO,
            0x44
        ]);
        mockSocket.expects("write").withArgs(cmdData);

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);
        obj.sendDo(dummySocket);

        mockSocket.verify();
    });
    it("Test sendDont() function", function() {
        let dummySocket = {write: function(data) {}};
        let mockSocket = sandbox.mock(dummySocket);
        let cmdData = new Uint8Array([
            TelnetOption.CMD_IAC,
            TelnetOption.CMD_DONT,
            0x44
        ]);
        mockSocket.expects("write").withArgs(cmdData);

        let obj = new TelnetOption(0x44, 'unit-test', TelnetOption.STATE_ENABLED);
        obj.sendDont(dummySocket);

        mockSocket.verify();
    });



});

describe("Testing class TelnetOptionSet", function() {

    let sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test constructor()", function() {
        let obj = new TelnetOptionSet();
        expect(obj.options).to.be.instanceof(Array);
    });
    it("Test addOption()", function() {

        let obj = new TelnetOptionSet();
        obj.addOption(0x44,'unit-test',TelnetOption.STATE_ENABLED);

        expect(obj.options.length).to.be.equal(1);
        expect(obj.options[0].optionCode).to.be.equal(0x44);
        expect(obj.options[0].optionName).to.be.equal('unit-test');
        expect(obj.options[0].desiredState).to.be.equal(TelnetOption.STATE_ENABLED);
    });
    it("Test setTn3270Options()", function() {

        let stub_addOption = sandbox.stub(TelnetOptionSet.prototype,'addOption')
            .callsFake( () => {} );

        let obj = new TelnetOptionSet();
        obj.setTn3270Options();

        expect(stub_addOption.callCount).to.be.equal(3);
        expect(stub_addOption.getCall(0).args).to.be.deep.equal([
            TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED
        ]);
        expect(stub_addOption.getCall(1).args).to.be.deep.equal([
            TelnetOption.OPTION_EOR, TelnetOption.DESC_OPTION_EOR, TelnetOption.STATE_ENABLED
        ]);
        expect(stub_addOption.getCall(2).args).to.be.deep.equal([
            TelnetOption.OPTION_TERMINAL_TYPE, TelnetOption.DESC_OPTION_TERMINAL_TYPE, TelnetOption.STATE_ENABLED
        ]);
    });
    it("Test getOptionInstance() - existing option", function() {

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        expect(obj.getOptionInstance(TelnetOption.OPTION_BINARY)).to.be.equal(obj.options[0]);
    });
    it("Test getOptionInstance() - new default (disabled) added option", function() {

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        expect(obj.getOptionInstance(TelnetOption.OPTION_EOR)).to.be.equal(obj.options[1]);
        expect(obj.options[1].optionCode).to.be.equal(TelnetOption.OPTION_EOR);
        expect(obj.options[1].optionName).to.be.equal('UNSUPPORTED_25');
        expect(obj.options[1].desiredState).to.be.equal(TelnetOption.STATE_DISABLED);
    });
    it("Test receiveCommand() - CMD_WILL", function() {

        let stub_TelnetOption_receivedWill = sandbox.stub(TelnetOption.prototype, 'receivedWill')
            .callsFake( () => {});
        let dummySocket = {}

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        expect(obj.receiveCommand(TelnetOption.CMD_WILL, TelnetOption.OPTION_EOR, dummySocket)).to.be.true;
        expect(stub_TelnetOption_receivedWill.callCount).to.be.equal(1);
        expect(stub_TelnetOption_receivedWill.getCall(0).args).to.be.deep.equal([dummySocket]);
    });
    it("Test receiveCommand() - CMD_WONT", function() {

        let stub_TelnetOption_receivedCmd = sandbox.stub(TelnetOption.prototype, 'receivedWont')
            .callsFake( () => {});
        let dummySocket = {}

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        expect(obj.receiveCommand(TelnetOption.CMD_WONT, TelnetOption.OPTION_EOR, dummySocket)).to.be.true;
        expect(stub_TelnetOption_receivedCmd.callCount).to.be.equal(1);
        expect(stub_TelnetOption_receivedCmd.getCall(0).args).to.be.deep.equal([dummySocket]);
    });
    it("Test receiveCommand() - CMD_DO", function() {

        let stub_TelnetOption_receivedCmd = sandbox.stub(TelnetOption.prototype, 'receivedDo')
            .callsFake( () => {});
        let dummySocket = {}

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        expect(obj.receiveCommand(TelnetOption.CMD_DO, TelnetOption.OPTION_EOR, dummySocket)).to.be.true;
        expect(stub_TelnetOption_receivedCmd.callCount).to.be.equal(1);
        expect(stub_TelnetOption_receivedCmd.getCall(0).args).to.be.deep.equal([dummySocket]);
    });
    it("Test receiveCommand() - CMD_DONT", function() {

        let stub_TelnetOption_receivedCmd = sandbox.stub(TelnetOption.prototype, 'receivedDont')
            .callsFake( () => {});
        let dummySocket = {}

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        expect(obj.receiveCommand(TelnetOption.CMD_DONT, TelnetOption.OPTION_EOR, dummySocket)).to.be.true;
        expect(stub_TelnetOption_receivedCmd.callCount).to.be.equal(1);
        expect(stub_TelnetOption_receivedCmd.getCall(0).args).to.be.deep.equal([dummySocket]);
    });

    it("Test setDesiredState() function", function() {
        let stub_TelnetOption_setDesiredState = sandbox.stub(TelnetOption.prototype, 'setDesiredState')
            .callsFake( () => {});
        let dummySocket = {}

        let obj = new TelnetOptionSet();
        obj.options = [
            new TelnetOption(TelnetOption.OPTION_BINARY, TelnetOption.DESC_OPTION_BINARY, TelnetOption.STATE_ENABLED)
        ];

        obj.setDesiredState(TelnetOption.OPTION_BINARY, TelnetOption.STATE_DISABLED, dummySocket);
        expect(stub_TelnetOption_setDesiredState.callCount).to.be.equal(1);
        expect(stub_TelnetOption_setDesiredState.getCall(0).args).to.be.deep.equal([
            TelnetOption.STATE_DISABLED, dummySocket]);

    });
});

describe("Testing class TelnetConnection", function() {

    let sandbox;
    let stub_socketWrite;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        stub_socketWrite = sandbox.stub(TelnetConnection.prototype, 'socketWrite')
            .callsFake( () => {} );
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("Test constructor()", function() {
        let obj = new TelnetConnection('unit-test',1234);
        expect(obj.host).to.be.equal('unit-test');
        expect(obj.port).to.be.equal(1234);

        expect(obj.telnetOptionSet).to.be.instanceof(TelnetOptionSet);
    });
    it("Test sendTerminalType()", function() {
        let obj = new TelnetConnection('unit-test',1234);

        obj.terminalType = 'A1234';

        obj.sendTerminalType();

        expect(stub_socketWrite.callCount).to.be.equal(1);
        expect(stub_socketWrite.getCall(0).args).to.be.deep.equal([
            new Uint8Array([ 0xff, 0xfa, 0x18, 0x00, 0x41, 0x31, 0x32, 0x33, 0x34, 0xff, 0xf0])
        ]);
    });
    it("Test executeCommandSB() terminal type", function() {
        let obj = new TelnetConnection('unit-test',1234);


        let dummyBuffer = new Uint8Array([
            0x41, 0x42, 0xff, 0xfa, 0x18, 0x01, 0xff, 0xf0, 0x43, 0x44
        ]);

        let stub_sendTerminalType = sandbox.stub(obj, 'sendTerminalType')
            .callsFake( () => {});
        obj.executeCommandSB(dummyBuffer, 2, 6);
        expect(stub_sendTerminalType.callCount).to.be.equal(1);

    });
    it("Test executeCommandSB() other", function() {
        let obj = new TelnetConnection('unit-test',1234);


        let dummyBuffer = new Uint8Array([
            0x41, 0x42, 0xff, 0xfa, 0x28, 0x01, 0xff, 0xf0, 0x43, 0x44
        ]);

        let stub_sendTerminalType = sandbox.stub(obj, 'sendTerminalType')
            .callsFake( () => {});
        obj.executeCommandSB(dummyBuffer, 2, 6);
        expect(stub_sendTerminalType.callCount).to.be.equal(0);

    });
    it("Test executeReceivedCommand() CMD_WILL", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0xff, 0xfb, 0x11, 0x41, 0x42
        ]));

        let stub_TelnetOptionSet_receiveCommand = sandbox.stub(obj.telnetOptionSet, 'receiveCommand')
            .callsFake( () => {});

        obj.executeReceivedCommand(dummyBuffer, 0);

        expect(stub_TelnetOptionSet_receiveCommand.callCount).to.be.equal(1);
        expect(stub_TelnetOptionSet_receiveCommand.getCall(0).args).to.be.deep.equal([
            0xfb, 0x11, obj.socket
        ]);
    });
    it("Test executeReceivedCommand() CMD_WONT", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0x41, 0x42, 0xff, 0xfc, 0x11, 0x41, 0x42
        ]));

        let stub_TelnetOptionSet_receiveCommand = sandbox.stub(obj.telnetOptionSet, 'receiveCommand')
            .callsFake( () => {});

        obj.executeReceivedCommand(dummyBuffer, 2);

        expect(stub_TelnetOptionSet_receiveCommand.callCount).to.be.equal(1);
        expect(stub_TelnetOptionSet_receiveCommand.getCall(0).args).to.be.deep.equal([
            0xfc, 0x11, obj.socket
        ]);
    });
    it("Test executeReceivedCommand() CMD_DO", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0x41, 0x42, 0x43, 0xff, 0xfd, 0x11
        ]));

        let stub_TelnetOptionSet_receiveCommand = sandbox.stub(obj.telnetOptionSet, 'receiveCommand')
            .callsFake( () => {});

        let cmdLen = obj.executeReceivedCommand(dummyBuffer, 3);

        expect(cmdLen).to.be.equal(3);
        expect(stub_TelnetOptionSet_receiveCommand.callCount).to.be.equal(1);
        expect(stub_TelnetOptionSet_receiveCommand.getCall(0).args).to.be.deep.equal([
            0xfd, 0x11, obj.socket
        ]);
    });
    it("Test executeReceivedCommand() CMD_DONT", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0xff, 0xfe, 0x11
        ]));

        let stub_TelnetOptionSet_receiveCommand = sandbox.stub(obj.telnetOptionSet, 'receiveCommand')
            .callsFake( () => {});

        let cmdLen = obj.executeReceivedCommand(dummyBuffer, 0);

        expect(cmdLen).to.be.equal(3);
        expect(stub_TelnetOptionSet_receiveCommand.callCount).to.be.equal(1);
        expect(stub_TelnetOptionSet_receiveCommand.getCall(0).args).to.be.deep.equal([
            0xfe, 0x11, obj.socket
        ]);
    });
    it("Test executeReceivedCommand() CMD_SE", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0x41, 0x42, 0xff, 0xf0, 0x41, 0x42
        ]));

        let stub_TelnetOptionSet_receiveCommand = sandbox.stub(obj.telnetOptionSet, 'receiveCommand')
            .callsFake( () => {});

        let cmdLen = obj.executeReceivedCommand(dummyBuffer, 2);
        expect(cmdLen).to.be.equal(2);

    });
    it("Test executeReceivedCommand() CMD_SB", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0x41, 0x42, 0xff, 0xfa, 0x18, 0x00, 0xff, 0xf0, 0x42
        ]));

        let stub_executeCommandSB = sandbox.stub(obj, 'executeCommandSB')
            .callsFake( () => {});

        let cmdLen = obj.executeReceivedCommand(dummyBuffer, 2);

        expect(cmdLen).to.be.equal(6);
        expect(stub_executeCommandSB.callCount).to.be.equal(1);
        expect(stub_executeCommandSB.getCall(0).args).to.be.deep.equal([
            dummyBuffer, 2, 6
        ]);
    });
    it("Test executeReceivedCommand() CMD_SB", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
            0xff, 0xfa, 0x18, 0x00, 0x41, 0x42, 0xff, 0xf0, 0x42
        ]));

        let stub_executeCommandSB = sandbox.stub(obj, 'executeCommandSB')
            .callsFake( () => {});

        let cmdLen = obj.executeReceivedCommand(dummyBuffer, 0);

        expect(cmdLen).to.be.equal(8);
        expect(stub_executeCommandSB.callCount).to.be.equal(1);
        expect(stub_executeCommandSB.getCall(0).args).to.be.deep.equal([
            dummyBuffer, 0, 8
        ]);
    });
    it("Test receivedData() with no command", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
         // A     B     C     D     E
            0x41, 0x42, 0x43, 0x44, 0x45
        ]));

        let stub_executeReceivedCommand = sandbox.stub(obj, 'executeReceivedCommand')
            .callsFake( () => { return 3; });

        obj.receivedData(dummyBuffer);

        expect(stub_executeReceivedCommand.callCount).to.be.equal(0);

        expect(obj.terminalReceivedDataBuffer.usedLength).to.be.equal(5);
        expect(obj.terminalReceivedDataBuffer.slice(0, obj.terminalReceivedDataBuffer.usedLength)).to.be.deep.equal(
            new Uint8Array([
            0x41, 0x42, 0x43, 0x44, 0x45
        ]));

    });
    it("Test receivedData() with embedded command", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
         // A     B     IAC   WILL  TERM-TYPE   C     D     E
            0x41, 0x42, 0xff, 0xfb, 0x25,       0x43, 0x44, 0x45
        ]));


        let stub_executeReceivedCommand = sandbox.stub(obj, 'executeReceivedCommand')
            .callsFake( () => { return 3; });
        // let stub_executeNegotiationCommand = sandbox.stub(obj, 'executeNegotiationCommand')
        //     .callsFake( () => {});
        let stub_forwardTerminalReceivedDataBuffer = sandbox.stub(obj, 'forwardTerminalReceivedDataBuffer')
            .callsFake( () => {});

        obj.receivedData(dummyBuffer);

        // expect(stub_executeNegotiationCommand.callCount).to.be.equal(1);
        expect(stub_executeReceivedCommand.callCount).to.be.equal(1);
        expect(stub_executeReceivedCommand.getCall(0).args).to.be.deep.equal([
            dummyBuffer, 2
        ]);

        expect(obj.terminalReceivedDataBuffer.usedLength).to.be.equal(5);
        expect(obj.terminalReceivedDataBuffer.slice(0, obj.terminalReceivedDataBuffer.usedLength)).to.be.deep.equal(
            new Uint8Array([
            0x41, 0x42, 0x43, 0x44, 0x45
        ]));

    });
    it("Test receivedData() ending with EOR", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
         // A     B     IAC   SB    TERM-TYPE   IAC   SE    C     D     E     IAC   EOR
            0x41, 0x42, 0xff, 0xfa, 0x18, 0x01, 0xff, 0xf0, 0x43, 0x44, 0x45, 0xff, 0xef
        ]));

        let stub_executeCommandSB = sandbox.stub(obj, 'executeCommandSB')
            .callsFake( () => {});
        let stub_forwardTerminalReceivedDataBuffer = sandbox.stub(obj, 'forwardTerminalReceivedDataBuffer')
            .callsFake( () => {});

        obj.receivedData(dummyBuffer);

        expect(stub_executeCommandSB.callCount).to.be.equal(1);
        expect(stub_executeCommandSB.getCall(0).args).to.be.deep.equal([
            dummyBuffer, 2, 6
        ]);

        expect(stub_forwardTerminalReceivedDataBuffer.callCount).to.be.equal(1);

        expect(stub_forwardTerminalReceivedDataBuffer.getCall(0).args.length).to.be.equal(1);
        let termBuffer = stub_forwardTerminalReceivedDataBuffer.getCall(0).args[0];

        expect(termBuffer.usedLength).to.be.equal(5);
        expect(termBuffer.slice(0, termBuffer.usedLength)).to.be.deep.equal(new Uint8Array([
            0x41, 0x42, 0x43, 0x44, 0x45
        ]));

    });
    it("Test receivedData() with escaped 0xFF, command and ending with EOR", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
         // A     B     IAC   IAC   IAC   SB    TERM-TYPE   IAC   SE    C     D     E     IAC   EOR
            0x41, 0x42, 0xff, 0xff, 0xff, 0xfa, 0x18, 0x01, 0xff, 0xf0, 0x43, 0x44, 0x45, 0xff, 0xef
        ]));

        let stub_executeCommandSB = sandbox.stub(obj, 'executeCommandSB')
            .callsFake( () => {});
        let stub_forwardTerminalReceivedDataBuffer = sandbox.stub(obj, 'forwardTerminalReceivedDataBuffer')
            .callsFake( () => {});

        obj.receivedData(dummyBuffer);

        expect(stub_executeCommandSB.callCount).to.be.equal(1);
        expect(stub_executeCommandSB.getCall(0).args).to.be.deep.equal([
            dummyBuffer, 4, 6
        ]);

        expect(stub_forwardTerminalReceivedDataBuffer.callCount).to.be.equal(1);

        expect(stub_forwardTerminalReceivedDataBuffer.getCall(0).args.length).to.be.equal(1);
        let termBuffer = stub_forwardTerminalReceivedDataBuffer.getCall(0).args[0];

        expect(termBuffer.usedLength).to.be.equal(6);
        expect(termBuffer.slice(0, termBuffer.usedLength)).to.be.deep.equal(new Uint8Array([
            0x41, 0x42, 0xff, 0x43, 0x44, 0x45
        ]));

    });
    it("Test receivedData() with terminal data already present, escaped 0xFF, IAC command and ending with EOR", function() {
        let obj = new TelnetConnection('unit-test',1234);
        let dummyBuffer = Buffer.from(new Uint8Array([
         // A     B     IAC   IAC   IAC   SB    TERM-TYPE   IAC   SE    C     D     E     IAC   EOR
            0x41, 0x42, 0xff, 0xff, 0xff, 0xfa, 0x18, 0x01, 0xff, 0xf0, 0x43, 0x44, 0x45, 0xff, 0xef
        ]));

        let stub_executeCommandSB = sandbox.stub(obj, 'executeCommandSB')
            .callsFake( () => {});
        let stub_forwardTerminalReceivedDataBuffer = sandbox.stub(obj, 'forwardTerminalReceivedDataBuffer')
            .callsFake( () => {});

        obj.terminalReceivedDataBuffer[0] = 0x31;
        obj.terminalReceivedDataBuffer[1] = 0x32;
        obj.terminalReceivedDataBuffer.usedLength = 2;

        obj.receivedData(dummyBuffer);

        expect(stub_executeCommandSB.callCount).to.be.equal(1);
        expect(stub_executeCommandSB.getCall(0).args).to.be.deep.equal([
            dummyBuffer, 4, 6
        ]);

        expect(stub_forwardTerminalReceivedDataBuffer.callCount).to.be.equal(1);

        expect(stub_forwardTerminalReceivedDataBuffer.getCall(0).args.length).to.be.equal(1);
        let termBuffer = stub_forwardTerminalReceivedDataBuffer.getCall(0).args[0];

        expect(termBuffer.usedLength).to.be.equal(8);
        expect(termBuffer.slice(0, termBuffer.usedLength)).to.be.deep.equal(new Uint8Array([
            0x31, 0x32, 0x41, 0x42, 0xff, 0x43, 0x44, 0x45
        ]));

    });

});