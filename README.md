# arras-client

Trying to connect the current arras.io client to the arras template server.

**This does not work yet.**

If you’re here expecting something playable: it isn’t.

# How to run

Download / clone the repo

Run the arras template server:

node server.js


Run the client:

node e.js

# Why it doesn’t work

The official arras.io servers use their own protocol.

The template server doesn’t match it.

To make this work, you need to:

- Make the server protocol match the official arras.io one

- Fix packets, handshake, encoding, etc.

**There's also a WAT file of the client arras.wasm file named app.wat which shows the readable text of the wasm file. It's still very hard to read and understand.**
