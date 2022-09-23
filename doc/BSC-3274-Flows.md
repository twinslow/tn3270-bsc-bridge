BSC Protocol Flows Between Host and 3270 Control Unit
=====================================================

The standard method for connecting a BSC 3274 controller to the host was via the 2703
communications controller with a BSC adapter. Communications from the host would be
initiated via a CCW channel command, which would include the BSC datastream
characters to be sent to the device. The 2703 would add additional prefix and pad
characters as required to complete the exchange.

Note that for a BSC device, the poll interaction initiates an implicit read modified
to the 3274.

The following IBM manual/section describes the BSC flows between host and 3274.

```
IBM 3270 Information Display System

3274 Control Unit Description and Programmer's Guide

GA23-0061-2.

See section on "Remote Operations -- BSC".
```

In this intereface implementation the usb-bsc-dongle hardware/firmware are sending the BSC flows over the communications line.

General and Specific Poll Flows
===============================


Initiated by:

CCW: Write (CC) - Send EOT (line reset)

`LPAD LPAD SYN SYN EOT PAD`

CCW: Write (CC) - Send Poll

`LPAD LPAD SYN SYN cuPoll cuPoll devAddr devAddr ENQ PAD`

Responses are ...

* No response -- (device unavailable) and timeout
* EOT -- The device has no data to send
* Status Message
  SOH % R STX cuPoll devAddr S/S-0 S/S-1 ETX BCC
* Test request message
  SOH % / STX text ETX|ETB BCC
* Read modified or short read modified response
  STX cuPoll devAddr text ETX|ETB BCC
* Read partition (query)
  DLE STX cuPoll devAddr text DLE ETX BCC

A test request message is generated  when TEST REQ or SYS REQ key is pressed
on terminal keyboard.

If multiple blocks of text are sent then the address bytes are only included in
the first block.

The host responds to each block of text with an ACK0|1, or a NAK. After the last
text block is responded to with an ACK, the 3270 will send an EOT.

A short read modified response is sent by the controller if the user pressed certain
AID keys, CLEAR or PA1/2. The short read modified response only sends the AID key id.

### Example of Read Modified poll responses

```
HOST --> LPAD LPAD SYN SYN cuPoll cuPoll devAddr devAddr ENQ PAD
3270 --> LPAD LPAD SYN SYN EOT PAD

HOST --> LPAD LPAD SYN SYN cuPoll cuPoll devAddr devAddr ENQ PAD
3270 --> LPAD LPAD SYN SYN STX cuPoll devAddr ****text**** ETB BCC1 BCC2 PAD
HOST --> LPAD LPAD SYN SYN ACK1 PAD
3270 --> LPAD LPAD SYN SYN STX ****text**** ETX BCC1 BCC2 PAD
HOST --> LPAD LPAD SYN SYN ACK0 PAD
3270 --> LPAD LPAD SYN SYN EOT PAD
```

Select and Write Flows
======================

Initiated by:

CCW: Write (CC) - Send EOT (line reset)

`LPAD LPAD SYN SYN EOT PAD`

CCW: Write (CC) - Send SELECT

`LPAD LPAD SYN SYN cuSelect cuSelect devAddr devAddr ENQ PAD`

CCW: Read

Responses to the select are ...

* No response - timeout
* RVI - The addressed device has pending status
* WACK - The device is busy
* ACK0 - The device has been selected

CCW: Write (CC)

`LPAD LPAD SYN SYN STX ESC command-code ****text**** ETB|ETX BCC1 BCC2 PAD`

And after the last block sent and acknowledged...

`LPAD LPAD SYN SYN EOT PAD`

CCW: Read

Responses are ...

* No response - timeout
* NAK - A bad BCC was read by the 3270
* ENQ - 3274 requests re-transmit of block
* EOT - The 3274 is unable to perform the operation, because of busy/unavailable/not-ready
* WACK - If start printer was set in WCC then text was received but printer is unavailable
* ACK1/0 - Block received successfully

### Example of Select/Write and responses

```
HOST --> LPAD LPAD SYN SYN EOT PAD
HOST --> LPAD LPAD SYN SYN cuSelect cuSelect devAddr devAddr ENQ PAD
3270 --> LPAD LPAD SYN SYN ACK0 PAD
HOST --> LPAD LPAD SYN SYN STX ESC EW WCC ****3270*orders**** ETB BCC1 BCC2 PAD
3270 --> LPAD LPAD SYN SYN ACK1 PAD
HOST --> LPAD LPAD SYN SYN STX ESC ****3270*orders**** ETX BCC1 BCC2 PAD
3270 --> LPAD LPAD SYN SYN ACK0 PAD
HOST --> LPAD LPAD SYN SYN EOT PAD
```

Note that orders cannot be split across a block in non-transparent mode. For example a text block can't
end with an SBA order byte and then the following block to start with the buffer address bytes.


