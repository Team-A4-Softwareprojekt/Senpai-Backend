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
const io = socketIO(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'https://senpai-development.onrender.com',
            'https://senpai-website.onrender.com'
        ],
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});
const cors = require('cors');

const allowedOrigins = [
    'https://senpai-development.onrender.com',
    'https://senpai-website.onrender.com',
    'http://localhost:5173'
];


// Erlaube Anfragen von der Entwicklungs-Umgebung
app.use(cors({
    origin: function (origin, callback) {
        // Prüft, ob der Ursprungsort in der Liste der zugelassenen Ursprünge enthalten ist
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));


// Verwende die Express-Routen
app.use('/', rest);

// Verwende die Socket.IO-Ereignishandler
handleSocketEvents(io);

/* Server hört auf eingehende Events auf festgelegtem Port*/
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});



