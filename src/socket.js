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
    const playerPoints = {}; // Zählt die Punkte der Spieler eine Lobby

    io.on('connection', (socket) => {
        console.log("Socket-Id: " + socket.id);

        socket.on('Buzzer_Queue', () => {
            console.log("START BUZZER QUEUE");

            let room = Object.keys(rooms).find(room => rooms[room].length === 1);
            if (!room) {
                room = `room-${socket.id}`;
                rooms[room] = [];
                playerPoints[room] = {};
            }

            socket.join(room);
            rooms[room].push(socket.id);

            if (rooms[room].length === 2) {
                const otherPlayer = rooms[room].find(id => id !== socket.id);
                //TODO: otherName und ownName aus Datendank holen, dies muss der Client Lobby Connect machen.
                io.to(otherPlayer).emit('Buzzer_GameFound', true, "otherName", "ownName");
                socket.emit('Buzzer_GameFound', true, "ownName", "otherName");
                sendQuestionToClient(socket);
            }
            playerPoints[room][socket.id] = 0;
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
                    delete playerPoints[room];
                }

                socket.leave(room);
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        });

        /*
        socket.on('AWAIT_QUESTION', () => {
            const room = getRoom(socket);
            if (!room) return;

            console.log(roundCounter[room])
            roundCounter[room] = (roundCounter[room] || 0)

            if (roundCounter[room] < 3) {
                if (!questions[room]) {
                    roundCounter[room] += 1;
                    //Hier muss darauf geachtet werden, wie die Frage von der Datenbank zurückkommt
                    getQuestionFromDB((question, table) => {
                        questions[room] = question;
                        io.to(room).emit('BUZZER_QUESTION_TYPE', table);
                        if (table === "multiplechoicequestion") {
                            io.to(room).emit('SHOW_QUESTION_MULTIPLE_CHOICE', question);
                        } else {
                            io.to(room).emit('SHOW_QUESTION_GAP_TEXT', question);
                        }
                    });
                }
            } else {
                console.log("ELSE ELSA")
                const otherPlayer = rooms[room].find(id => id !== socket.id);
                io.to(otherPlayer).emit("END_BUZZER_GAME", playerPoints[room][otherPlayer], playerPoints[room][socket])
                socket.emit("END_BUZZER_GAME", playerPoints[room][socket], playerPoints[room][otherPlayer])

            }

        });

        */

        socket.on('PLAYER_BUZZERED', () => {
            const room = getRoom(socket);
            if (!room) return;

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            io.to(otherPlayer).emit('DISABLE_BUZZER');
            //socket.emit('PICK_ANSWER');
        });

        socket.on('COMPARE_ANSWER', (answer) => {
            const room = getRoom(socket);
            if (!room) return;

            //hier muss sichergestellt werden, dass über questions[room].correctAnswer auf die Antwort zugegriffen werden kann
            const correctAnswer = questions[room].solution;
            answers[room] = answers[room] || {};
            answers[room][socket.id] = answer;

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            const bothAnswered = answers[room][socket.id] && answers[room][otherPlayer];

            // Spieler "buzzered" falsch -> Spieler "other" keine antwort -> Spieler "other" bekommt x Punkt
            // Spieler "buzzered" falsch -> Spieler "other" richtig -> Spieler "other" bekommt x Punkte
            // Spieler "buzzered" falsch -> Spieler "other" falsch -> Spieler "other" bekommt x Punkt
            // Spieler "buzzered" richtig -> Spieler "buzzered" bekommt x Punkte
            if (answer === correctAnswer) { //antwort richtig

                //TODO: NEUE EMITS um beim Gegenspieler auch den richtigen Popup anzeigen lassen zu können
                //TODO: socket.emit('ENEMY_CORRECT_ANSWER")
                // Diese Runde geht an "Spielername"
                // Die richtige Antwort wäre gewesen: D
                // (bspw. mit einem roten Rand))

                //TODO: ENABLE_BUZZER scheint in den ersten zwei Bedingungen (if und if-else) überflüssig zu sein
                // bitte testen

                socket.emit('CORRECT_ANSWER');
                console.log("correct answer")
                // Add points logic here
                playerPoints[room][socket.id] += 1;
                playerPoints[room][otherPlayer] += 0;

                resetRoomQuestion(socket);
                io.to(otherPlayer).emit('ENABLE_BUZZER');
                io.to(room).emit('END_ROUND');

            } else if (bothAnswered) {  //beide falsch?
                resetRoomQuestion(socket);
                io.to(otherPlayer).emit('ENABLE_BUZZER');
                io.to(room).emit('END_ROUND');

            } else { //antwort falsch, gegenspieler darf
                socket.emit('WRONG_ANSWER');
                io.to(otherPlayer).emit('ENABLE_BUZZER');
                //socket.emit('DISABLE_BUZZER');
            }
        });

        socket.on('CLOSE_LOBBY', () => {
            const room = getRoom(socket);
            if (!room) return;

            delete rooms[room];
            delete questions[room];
            delete answers[room];
            delete roundCounter[room];
            delete playerPoints[room];


        });

        socket.on('disconnect', () => {
            const room = getRoom(socket);
            console.log(socket + "disconnected.")
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
                delete playerPoints[room];
            }

        });

    });

    function getRoom(socket) {
        return Object.keys(rooms).find(room => rooms[room].includes(socket.id));
    }

    function getQuestionFromDB(callback) {
        // Zufällig eine Tabelle auswählen
        const tables = ['multiplechoicequestion', 'gaptextquestion'];
        //const selectedTable = tables[Math.floor(Math.random() * tables.length)];
        const selectedTable = 'multiplechoicequestion';

        console.log(selectedTable)

        // Query basierend auf der ausgewählten Tabelle erstellen
        const query = `SELECT *
                       FROM multiplechoicequestion
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

    function sendQuestionToClient(socket) {

        const room = getRoom(socket);
        if (!room) return;

        roundCounter[room] = (roundCounter[room] || 0) + 1
        console.log("sendQuestionToClient(): " + roundCounter[room])

        getQuestionFromDB((question, table) => {
            questions[room] = question;
            io.to(room).emit('BUZZER_QUESTION_TYPE', table);
            if (table === "multiplechoicequestion") {
                io.to(room).emit('SHOW_QUESTION_MULTIPLE_CHOICE', question);
                console.log(rooms[room])
            } else {
                io.to(room).emit('SHOW_QUESTION_GAP_TEXT', question);
            }
        });

    }


    //TODO: TIMER SOLL BESTIMMEN WANN EINE NEUE FRAGE GENERIERT WIRD, wo soll der Timer hin?
    function resetRoomQuestion(socket) {
        const room = getRoom(socket);

        const otherPlayer = rooms[room].find(id => id !== socket.id);

        questions[room] = null;
        answers[room] = {};
        if (roundCounter[room] < 3) {
            sendQuestionToClient(socket);
        } else {
            io.to(otherPlayer).emit("END_BUZZER_GAME", playerPoints[room][otherPlayer], playerPoints[room][socket])
            socket.emit("END_BUZZER_GAME", playerPoints[room][socket], playerPoints[room][otherPlayer])
        }
    }

}

module.exports = handleSocketEvents;
