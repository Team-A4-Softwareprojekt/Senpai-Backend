// Build Command: npm install
// Start Command: npm start

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const rest = require('./rest');
const handleSocketEvents = require('./socket');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const cors = require('cors');

// Erlaube Anfragen von der Entwicklungs-Umgebung
app.use(cors({
    origin: 'https://senpai-development.onrender.com'
}));

// Verwende die Express-Routen
app.use('/', rest);

// Verwende die Socket.IO-Ereignishandler
handleSocketEvents(io);

/* Server hört auf eingehende Events auf festgelegtem Port*/
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
