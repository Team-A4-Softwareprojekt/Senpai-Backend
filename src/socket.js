const socketIO = require('socket.io');

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
                getQuestionFromDB((question) => {
                    questions[room] = question;
                    io.to(room).emit('SHOW_QUESTION', question);

                    // Timer für die Frage
                    let timeLeft = 10; // Beispiel: 10 Sekunden Timer
                    const timer = setInterval(() => {
                        timeLeft--;
                        io.to(room).emit('TIMER', timeLeft);

                        if (timeLeft <= 0) {
                            clearInterval(timer);
                        }
                    }, 1000);
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
        // HIER MUSS DIE LOGIK FÜR DIE DATENBANKABFRAGE REIN, EIN BEISPIEL IST HIER ZU FINDEN:
        //             const query = "SELECT id, questionText, correctAnswer FROM questions ORDER BY RAND() LIMIT 1";
        //             db.query(query, (err, result) => {
        //                 if (err) {
        //                     console.error("Error fetching question: ", err);
        //                     return;
        //                 }
        //                 if (result.length > 0) {
        //                     callback(result[0]);
        //                 } else {
        //                     console.error("No question found in the database.");
        //                 }
        //             });
        //
    }
}

module.exports = handleSocketEvents;

// TODO: HIER MUSS SERVER ANTWORT KOMMEN