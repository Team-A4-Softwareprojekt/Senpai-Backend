/*========== SERVER ==========*/

/* Imports */
const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');
const {Socket} = require('dgram');


/* Server erzeugen und socketIO Server zuweisen */
const PORT = process.env.PORT || 3000;
const server = http.createServer();
const io = socketIO(server);


/* Server hört auf eingehende Events auf festgelegtem Port */
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

io.on('connection', (socket) => {
    console.log("Socket-Id: " + socket.id)
});