const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const rest = require('./rest');
const handleSocketEvents = require('./socket');
const bodyParser = require('body-parser');
const cors = require('cors');
const {initializeIO} = require('./functions');

const PORT = process.env.PORT || 3000; // Set the server port

const app = express(); // Create an instance of the Express app
const server = http.createServer(app); // Create an HTTP server using the Express app
const io = socketIO(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'http://localhost:5176',
            'https://senpai-development.onrender.com',
            'https://senpai-website.onrender.com'
        ],
        methods: ["GET", "POST"], // Allowed HTTP methods
        allowedHeaders: ["my-custom-header"], // Allowed custom headers
        credentials: true // Allow credentials (cookies, authorization headers, etc.)
    }
});

// Define the allowed origins for CORS
const allowedOrigins = [
    'https://senpai-development.onrender.com',
    'https://senpai-website.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176'
];

// Allow requests from the development environment
app.use(cors({
    origin: function (origin, callback) {
        // Check if the origin is in the list of allowed origins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(bodyParser.json()); // Use body-parser middleware to parse JSON requests

// Use the Express routes defined in the 'rest' module
app.use('/', rest);

// Use the Socket.IO event handlers defined in the 'socket' module
handleSocketEvents(io);
initializeIO(io);

/**
 * Start the server and listen for incoming events on the specified port.
 */
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
