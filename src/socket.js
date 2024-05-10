const socketIO = require('socket.io');

function handleSocketEvents(io) {
    io.on('connection', (socket) => {
        console.log("Socket-Id: " + socket.id);

        socket.on('message', (message) => {
            console.log(message);
        });

        socket.on(`registration`, (username, password, address, zipcode, number, email, safetyAnswer) => {
            //Sende Daten an die Datenbank, überprüfe ob der User schon existiert anhand der Email
            //Wenn nicht, dann erstelle einen neuen User und gib einen boolean zurück
            registrationSuccessful = true;
            socket.emit(`registrationSuccess`, registrationSuccessful);
        });

        socket.on('login', (username, password) => {
            //Sende Daten an die Datenbank, überprüfe ob der User existiert und das Passwort stimmt
            //wenn ja, dann gib einen boolean zurück
            loginSuccessful = true;
            socket.emit('loginSuccess', loginSuccessful);
        });

        socket.on('forgotPassword', (email, safetyAnswer) => {
            //wenn safetyAnswer == Wert auf Datenbank, dann ändere das Passwort und gib einen boolean zurück
            forgotPasswordSuccessful = true;
            socket.emit('forgotPasswordSuccess', forgotPasswordSuccessful);
        });
    });
}

module.exports = handleSocketEvents;
