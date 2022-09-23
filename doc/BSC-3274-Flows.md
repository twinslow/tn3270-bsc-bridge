BSC Protocol Flows Between Host and 3270 Control Unit
=====================================================

The standard method for connecting a BSC 3274 controller to the host was via the 2703
communications controller with a BSC adapter. Communications from the host would be
initiated via a CCW channel command, which would include the BSC datastream
characters to be sent to the device. The 2703 would add additional prefix and pad
characters as required to complete the exchange.

Note that for a BSC device, the poll interaction initiates an implicit read modified
to the 3274.

The following manual/section describes the BSC flows between host and 3274.

```
IBM: 3274 Control Unit Description and Programmers Guide - GA23-0061. See section on "Remote Operations -- BSC".
```

In this intereface implementation the usb-bsc-dongle hardware/firmware are sending the BSC flows over the communications line.

General and Specific Poll Flows
-------------------------------

CCW: Write (CC) - Send EOT (line reset)
                  LPAD LPAD SYN SYN EOT PAD

CCW: Write (CC) - Send Poll
                  LPAD LPAD SYN SYN cuPoll cuPoll devAddr devAddr ENQ PAD

                  Responses are ...
                  A) No response -- (device unavailable) and timeout
                  B) EOT -- The device has no data to send
                  C) Status Message
                     SOH % R STX cuPoll devAddr S/S-0 S/S-1 ETX BCC
                  D) Test request message
                     SOH % / STX text ETX|ETB BCC
                  E) Read modified or short read modified response
                     STX cuPoll devAddr text ETX|ETB BCC
                  F) Read partition (query)
                     DLE STX cuPoll devAddr text DLE ETX BCC

                  A test request message (D) is generated  when TEST REQ or SYS REQ key is pressed
                  on terminal keyboard.

                  If multiple blocks of text are sent then the address bytes are only included in
                  the first block.

                  The host responds to each block of text with an ACK0|1, or a NAK. After the last
                  text block is responded to with an ACK, the 3270 will send an EOT.

                  ### Example of (E) Read Modified poll responses

                  HOST --> LPAD LPAD SYN SYN cuPoll cuPoll devAddr devAddr ENQ PAD
                  3270 --> LPAD LPAD SYN SYN EOT PAD

                  HOST --> LPAD LPAD SYN SYN cuPoll cuPoll devAddr devAddr ENQ PAD
                  3270 --> LPAD LPAD SYN SYN STX cuPoll devAddr ****text**** ETB BCC1 BCC2 PAD
                  HOST --> LPAD LPAD SYN SYN ACK1 PAD
                  3270 --> LPAD LPAD SYN SYN STX ****text**** ETX BCC1 BCC2 PAD
                  HOST --> LPAD LPAD SYN SYN ACK0 PAD
                  3270 --> LPAD LPAD SYN SYN EOT PAD




