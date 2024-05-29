const socketIO = require('socket.io');
const {Client} = require('pg');

// Verbindungsinformationen
const client = new Client({
    user: 'lernplattformdb_user',
    host: 'dpg-cotl9a7109ks73an4iug-a.frankfurt-postgres.render.com',
    database: 'lernplattformdb',
    password: 'z46dQYVIYnVeGf19tLgyWCg4g2Uo0u4n',
    port: 5432, // Standardport für PostgreSQL,
    ssl: true
});

client.connect(undefined)
    .then(() => console.log('Socket verbunden mit der PostgreSQL-Datenbank'))
    .catch(err => console.error('Verbindung fehlgeschlagen', err));

function handleSocketEvents(io) {
    const rooms = {}; // Speichert die Räume und die Spieler darin
    const questions = {}; // Speichert die aktuellen Fragen pro Raum
    const answers = {}; // Speichert die Antworten der Spieler pro Raum
    const roundCounter = {}; // Zählt die Aufrufe von AWAIT_QUESTION pro Raum

    io.on('connection', (socket) => {
        console.log("Socket-Id: " + socket.id);

        socket.on('Buzzer_Queue', () => {
            console.log("START BUZZER QUEUE");

            let room = Object.keys(rooms).find(room => rooms[room].length === 1);
            if (!room) {
                room = `room-${socket.id}`;
                rooms[room] = [];
            }

            socket.join(room);
            rooms[room].push(socket.id);

            if (rooms[room].length === 2) {
                io.to(room).emit('Buzzer_GameFound', true);
            }
        });

        socket.on('Leave_Buzzer_Queue', () => {
            console.log("LEAVE BUZZER QUEUE");

            // Find the room the socket is in
            let room = Object.keys(rooms).find(room => rooms[room].includes(socket.id));

            if (room) {
                // Remove the socket from the room
                rooms[room] = rooms[room].filter(id => id !== socket.id);

                // If the room is now empty, delete it
                if (rooms[room].length === 0) {
                    delete rooms[room];
                } else {
                    // Notify the remaining user(s) in the room
                    io.to(room).emit('Buzzer_GameFound', false);
                }

                socket.leave(room);
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        });


        socket.on('AWAIT_QUESTION', () => {
            const room = getRoom(socket);
            if (!room) return;

            roundCounter[room] = (roundCounter[room] || 0) + 1;

            if (roundCounter[room] <= 3) {
                //Hier muss darauf geachtet werden, wie die Frage von der Datenbank zurückkommt
                getQuestionFromDB((question, table) => {
                    questions[room] = question;
                    io.to(room).emit('SHOW_QUESTION', question, table);
                });
            } else {
                io.to(room).emit('END_GAME');
            }
        });

        socket.on('PLAYER_BUZZERED', () => {
            const room = getRoom(socket);
            if (!room) return;

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            io.to(otherPlayer).emit('DISABLE_BUZZER');
            socket.emit('PICK_ANSWER');
        });

        socket.on('COMPARE_ANSWER', (answer) => {
            const room = getRoom(socket);
            if (!room) return;

            //hier muss sichergestellt werden, dass über questions[room].correctAnswer auf die Antwort zugegriffen werden kann
            const correctAnswer = questions[room].correctAnswer;
            answers[room] = answers[room] || {};
            answers[room][socket.id] = answer;

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            const bothAnswered = answers[room][socket.id] && answers[room][otherPlayer];

            // Spieler "buzzered" falsch -> Spieler "other" keine antwort -> Spieler "other" bekommt x Punkt
            // Spieler "buzzered" falsch -> Spieler "other" richtig -> Spieler "other" bekommt x Punkte
            // Spieler "buzzered" falsch -> Spieler "other" falsch -> Spieler "other" bekommt x Punkt
            // Spieler "buzzered" richtig -> Spieler "buzzered" bekommt x Punkte
            if (answer === correctAnswer) {
                socket.emit('CORRECT_ANSWER', correctAnswer);
                // Add points logic here
                io.to(room).emit('END_ROUND');
            } else if (bothAnswered) {
                io.to(room).emit('END_ROUND');
            } else {
                io.to(otherPlayer).emit('ENABLE_BUZZER');
                socket.emit('DISABLE_BUZZER');
            }
        });

        socket.on('disconnect', () => {
            const room = getRoom(socket);
            if (room) {
                // Informiere den anderen Spieler im Raum über die Trennung
                const otherPlayer = rooms[room].find(id => id !== socket.id);
                if (otherPlayer) {
                    io.to(otherPlayer).emit('OPPONENT_DISCONNECTED');
                }
                delete rooms[room];
                delete questions[room];
                delete answers[room];
                delete roundCounter[room];
            }

        });

    });

    function getRoom(socket) {
        return Object.keys(rooms).find(room => rooms[room].includes(socket.id));
    }

    function getQuestionFromDB(callback) {
        // Zufällig eine Tabelle auswählen
        const tables = ['multiplechoicequestion', 'gaptextquestion'];
        const selectedTable = tables[Math.floor(Math.random() * tables.length)];

        console.log(selectedTable)

        // Query basierend auf der ausgewählten Tabelle erstellen
        const query = `SELECT *
                       FROM ${selectedTable}
                       ORDER BY RANDOM() LIMIT 1`;

        client.query(query, (err, result) => {
            if (err) {
                console.error("Error fetching question: ", err);
                return;
            }
            if (result.rows.length > 0) {
                callback(result.rows[0], selectedTable);
            } else {
                console.error("No question found in the database.");
            }
        });
    }

}

module.exports = handleSocketEvents;
