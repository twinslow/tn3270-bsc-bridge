TN3270 to BSC bridge
--------------------

This is a work in progress and is not functional at this point.

## Introduction

This is all about my attempt to connect a real IBM 3174 cluster controller to the Hercules-390 emulator, running
MVS3.8J (TK4-). I started with an idea to use SDLC communications to my 3174-91R controller, but decided to
try a path of lesser resistance so I wouldn't have to deal with the SNA protocol.

The idea here is to create use this software to write and read BSC frames to a USB attached dongle (looking as a basic serial port) that then writes the data to a synchronous RS-232 interface.

```mermaid
flowchart TD
    tn3270[Hercules TN3270 server]
    bridge[TN3270 BSC bridge]
    dongle["USB to synchronous serial (BSC) dongle"]
    3174[IBM 3174-91R cluster controller]
    3179[IBM 3179 terminal]
    tn3270 <--> |TN3270 TCP/IP connection|bridge
    bridge <--> |USB serial device|dongle
    dongle <--> |RS-232 synchronous serial|3174
    3174 <--> |Coax attachment CUT|3179
```