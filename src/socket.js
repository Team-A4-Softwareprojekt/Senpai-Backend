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
    const playerNames = {};
    const playerReady = {};
    const buzzerTimerDuration = 23000; // 23s
    const questionTimers = {}; // Speichert die Timer für die Fragen pro Raum
    const playerTurnTimers = {}; // Speichert die Timer für die Spielerzüge pro Raum
    const tableGLOBAL = {}; // Speichert die Tabellen pro Raum

    const playerPointsManipulation = {}; // Zählt die Punkte der Spieler eine Lobby
    const playerNamesManipulation = {};
    const manipulationRooms = {}; // Speichert die Räume und die Spieler darin
    const playerReadyManipulation = {};
    let roundEndManipulationCounter = 0;

    io.on('connection', (socket) => {
        console.log("Socket-Id: " + socket.id);

        socket.on('Buzzer_Queue', (playerName) => {
            console.log("START BUZZER QUEUE");

            playerNames[socket.id] = playerName;

            let room = Object.keys(rooms).find(room => rooms[room].length === 1);
            if (!room) {
                room = `room-${socket.id}`;
                rooms[room] = [];
                playerPoints[room] = {};
                playerReady[room] = {};
            }

            socket.join(room);
            rooms[room].push(socket.id);

            if (rooms[room].length === 2) {
                const otherPlayer = rooms[room].find(id => id !== socket.id);

                io.to(otherPlayer).emit('Buzzer_GameFound', true);
                socket.emit('Buzzer_GameFound', true);

                startGameCountdownBuzzer(socket);
                sendQuestionToClient(socket)

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


        socket.on('REQUEST_DAILY_CHALLENGE_QUESTION', () => {
            getGapTextFromDB((question, table) => {
                io.to(socket.id).emit('BUZZER_QUESTION_TYPE', table);
                if(table === "gaptextquestion") {
                    io.to(socket.id).emit('RECEIVE_QUESTION_GAP_TEXT', question);
                } else {
                    io.to(socket.id).emit('RECEIVE_QUESTION_MULTIPLE_CHOICE', question);
                }
            });
        });


        socket.on('PLAYER_BUZZERED', () => {
            const room = getRoom(socket);
            if (!room) return;

            // Stoppe den Timer für die Spielrunde
            clearInterval(playerTurnTimers[room]);
            clearInterval(questionTimers[room]);

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            io.to(otherPlayer).emit('DISABLE_BUZZER');

            // Informiere den Gegner, dass der Buzzer zuerst gedrückt wurde
            io.to(otherPlayer).emit('OPPONENT_BUZZERED');

            // Starte den Timer für den Spielerzug
            playerTurnTimers[room] = startPlayerTurnTimer(socket);
        });


        socket.on('COMPARE_ANSWER', (answer) => {
            const room = getRoom(socket);
            if (!room) return;

            clearInterval(playerTurnTimers[room]);

            //hier muss sichergestellt werden, dass über questions[room].correctAnswer auf die Antwort zugegriffen werden kann
            const correctAnswer = questions[room].solution;
            answers[room] = answers[room] || {};
            answers[room][socket.id] = answer;

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            const otherPlayerSocket = io.sockets.sockets.get(otherPlayer);
            const bothAnswered = answers[room][socket.id] && answers[room][otherPlayer];

            if (answer === correctAnswer) { //antwort richtig

                //TODO: ENABLE_BUZZER scheint in den ersten zwei Bedingungen (if und if-else) überflüssig zu sein
                // bitte testen

                socket.emit('CORRECT_ANSWER');
                console.log("correct answer")
                // Add points logic here
                playerPoints[room][socket.id] += 1;

                console.log(playerPoints[room][socket.id])
                console.log(playerPoints[room][otherPlayer])

                io.to(otherPlayer).emit('ENABLE_BUZZER');

                socket.emit('END_ROUND', playerNames[socket.id], correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                io.to(otherPlayer).emit('END_ROUND', playerNames[socket.id], correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id]);
                resetRoomQuestion(socket);

            } else if (bothAnswered) {  //beide falsch?

                io.to(otherPlayer).emit('ENABLE_BUZZER');
                playerPoints[room][socket.id] -= 1;

                socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                io.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id])
                resetRoomQuestion(socket);

                console.log("BEIDE GEANTWORTET - DEBUGGING")

            } else { //antwort falsch, gegenspieler darf
                playerPoints[room][socket.id] -= 1;
                socket.emit('WRONG_ANSWER');
                io.to(otherPlayer).emit('ENABLE_BUZZER');
                io.to(otherPlayer).emit('OPPONENT_WRONG_ANSWER');
                playerTurnTimers[room] = startPlayerTurnTimer(otherPlayerSocket);
                console.log("FALSCHE ANTWORT -  DEBUGGING")
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
            delete playerNames[room];
            delete playerReady[room];


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
                delete playerNames[room];
                delete playerReady[room];

                socket.leave(room);
            }

        });


        /**
         * This is the listener for the automated test
         * */
        socket.on('CONNECTION_TEST', () => {
            console.log("connection test received")
            socket.emit('CONNECTION_TEST_SUCCESSFULLY', true);

        });

         // --------------------------------------MANIPULATION GAME MODE---------------------------------------------------------//
         
        socket.on('Manipulation_Queue', (playerName) => {
            console.log("START MANIPULATION QUEUE");

            playerNamesManipulation[socket.id] = playerName;
            console.log(playerNamesManipulation[socket.id]);

            let roomManipulation = Object.keys(manipulationRooms).find(roomManipulation => manipulationRooms[roomManipulation].length === 1);
            if (!roomManipulation) {
                roomManipulation = `roomManipulation-${socket.id}`;
                manipulationRooms[roomManipulation] = [];
                playerPointsManipulation[roomManipulation] = {};
                playerReadyManipulation[roomManipulation] = {};
            }

            socket.join(roomManipulation);
            manipulationRooms[roomManipulation].push(socket.id);

            if (manipulationRooms[roomManipulation].length === 2) {
                const otherPlayer = manipulationRooms[roomManipulation].find(id => id !== socket.id);
                io.to(otherPlayer).emit('Manipulation_GameFound', true);
                socket.emit('Manipulation_GameFound', true);

                startGameCountdownManipulation(socket);
                sendQuestionToClientManipulation(socket)
                // spieler 1 und spieler zwei emiten
                io.to(otherPlayer).emit('PLAYER_ONE_MANIPULATION', playerNamesManipulation[socket.id]);
                socket.emit('PLAYER_TWO_MANIPULATION', playerNamesManipulation[otherPlayer]);

            }
            playerPointsManipulation[roomManipulation][socket.id] = 0;
        });

        socket.on('Leave_Manipulation_Queue', () => {
            console.log("LEAVE MANIPUTLATION QUEUE");

            // Find the room the socket is in
            let room = Object.keys(manipulationRooms).find(room => manipulationRooms[room].includes(socket.id));

            if (room) {
                // Remove the socket from the room
                manipulationRooms[room] = manipulationRooms[room].filter(id => id !== socket.id);

                // If the room is now empty, delete it
                if (manipulationRooms[room].length === 0) {
                    delete manipulationRooms[room];
                    delete playerPointsManipulation[room];
                }

                socket.leave(room);
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        });

        socket.on('SUBMIT_CHANGES_MANIPULATION', (data) => {
            const code = data.code;
            const answer = data.expectedOutput;

            console.log("SUBMIT CHANGES MANIPULATION");
            const room = getRoomManipulation(socket);
            const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);
            // Sende 'ENABLE_INPUT_MANIPULATION' an den anderen Spieler
            socket.to(otherPlayer).emit('ENABLE_INPUT_MANIPULATION', {code, answer});
            console.log(code);
        });

        socket.on('ROUND_END_MANIPULATION', (rightAnswer) => {
            roundEndManipulationCounter++;
            const room = getRoomManipulation(socket);
            console.log("ROUND END MANIPULATION");

            /*if(roundEndManipulationCounter <= 3){
            }*/
            const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);
            // Sende 'ENABLE_INPUT_MANIPULATION' an den anderen Spieler
            socket.to(otherPlayer).emit('START_NEW_ROUND_MANIPULATION');
            console.log("start new round");
            socket.emit('START_NEW_ROUND_MANIPULATION');

        });
    });

    function getRoom(socket) {
        return Object.keys(rooms).find(room => rooms[room].includes(socket.id));
    }



    function getGapTextFromDB(callback) {
        const selectedTable = 'gaptextquestion';

        console.log(selectedTable)

        // Query basierend auf der ausgewählten Tabelle erstellen
        const query = `SELECT *
                       FROM gaptextquestion
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

    function getMultipleChoiceFromDB(callback) {
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

        getMultipleChoiceFromDB((question, table) => {
            questions[room] = question;

            tableGLOBAL[room] = table;

            if (table === "multiplechoicequestion") {
                //io.to(room).emit('SHOW_QUESTION_MULTIPLE_CHOICE', question);
                io.to(room).emit('SET_BUZZER_QUESTION', question);
                console.log(rooms[room])
            } else {
                //io.to(room).emit('SHOW_QUESTION_GAP_TEXT', question);
                io.to(room).emit('SET_BUZZER_QUESTION', question);
            }
        });

        if(roundCounter[room] > 1){
            questionTimers[room] = startTimerBuzzer(socket);
        }

    }


    function resetRoomQuestion(socket) {
        const room = getRoom(socket);

        const otherPlayer = rooms[room].find(id => id !== socket.id);

        questions[room] = null;
        answers[room] = {};
        if (roundCounter[room] < 3) {
            sendQuestionToClient(socket);
        } else {
            io.to(otherPlayer).emit("END_BUZZER_GAME", playerPoints[room][otherPlayer], playerPoints[room][socket.id])
            socket.emit("END_BUZZER_GAME", playerPoints[room][socket.id], playerPoints[room][otherPlayer])
        }
    }

    // Funktion, um den Timer zu starten
    function startTimerBuzzer(socket) {
        const room = getRoom(socket);
        const otherPlayer = rooms[room].find(id => id !== socket.id);

        let remainingSeconds = buzzerTimerDuration / 1000; // Gesamte Anzahl von Sekunden

        const timer = setInterval(() => {
            remainingSeconds--; // Reduziere die verbleibenden Sekunden um 1

            // Sende die verbleibenden Sekunden an den Client
            io.to(room).emit('BUZZER_TIMER_TICK', remainingSeconds);

            if (remainingSeconds <= 0) {
                const correctAnswer = questions[room].solution;

                clearInterval(timer); // Stoppe den Timer, wenn die Zeit abgelaufen ist
                io.to(otherPlayer).emit('ENABLE_BUZZER');

                socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                io.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id])

                resetRoomQuestion(socket);
            }
        }, 1000); // Wiederhole alle 1000ms (1 Sekunde)

        return timer; // Gib den Timer zurück, um darauf zugreifen zu können
    }

    // Funktion, um den Timer für den Spielerzug zu starten

    function startPlayerTurnTimer(socket) {
        const room = getRoom(socket);

        answers[room] = answers[room] || {};

        let remainingSeconds = 5; // Anzahl von Sekunden für den Spielerzug

        const timer = setInterval(() => {
            remainingSeconds--; // Reduziere die verbleibenden Sekunden um 1

            // Sende die verbleibenden Sekunden an den Client
            io.to(room).emit('PLAYER_TURN_TIMER_TICK', remainingSeconds);

            if (remainingSeconds <= 0) {
                clearInterval(timer); // Stoppe den Timer, wenn die Zeit abgelaufen ist

                answers[room][socket.id] = 'empty';
                const otherPlayer = rooms[room].find(id => id !== socket.id);
                const correctAnswer = questions[room].solution;
                const bothAnswered = answers[room][socket.id] && answers[room][otherPlayer];

                // Hier die angepasste Logik bei Ablauf des Timers
                if (bothAnswered) {
                    // beide haben falsch geantwortet
                    io.to(otherPlayer).emit('ENABLE_BUZZER');
                    socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                    io.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id]);
                    resetRoomQuestion(socket);
                } else {
                    // aktueller Spieler hat falsch geantwortet, der andere Spieler darf
                    playerPoints[room][socket.id] -= 1;
                    socket.emit('WRONG_ANSWER');
                    io.to(otherPlayer).emit('ENABLE_BUZZER');
                    io.to(otherPlayer).emit('OPPONENT_WRONG_ANSWER');

                }
            }
        }, 1000); // Wiederhole alle 1000ms (1 Sekunde)

        return timer; // Gib den Timer zurück, um darauf zugreifen zu können
    }

    function startGameCountdownBuzzer(socket) {
        const room = getRoom(socket);
        let remainingSeconds = 4;

        const timer = setInterval(() => {
            remainingSeconds--;

            if (remainingSeconds <= 0) {
                clearInterval(timer);

                // Starte den Timer

                io.to(room).emit('BUZZER_QUESTION_TYPE', tableGLOBAL[room]);
                questionTimers[room] = startTimerBuzzer(socket);
            }

            io.to(room).emit('BUZZER_COUNTDOWN', remainingSeconds);

        }, 1000);
    }

    //------------------------------------MANIPULATION GAME MODE------------------------------------------------------------------------------//
    
    function getRoomManipulation(socket) {
        return Object.keys(manipulationRooms).find(room => manipulationRooms[room].includes(socket.id));
    }

    function getCodeFromDB(callback) {
        const selectedTable = 'manipulation';

       console.log(selectedTable);

       // Query basierend auf der ausgewählten Tabelle erstellen
       const query = `SELECT *
                      FROM manipulation
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

    function sendQuestionToClientManipulation(socket) {
        const room = getRoomManipulation(socket);
        if (!room) return;

        roundCounter[room] = (roundCounter[room] || 0) + 1
        console.log("sendQuestionToClient(): " + roundCounter[room])

        getCodeFromDB((question, table) => {
            questions[room] = question;

            tableGLOBAL[room] = table;

            if (table === "manipulation") {
                const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);
                // Sende 'ENABLE_INPUT_MANIPULATION' an den anderen Spieler
                socket.to(otherPlayer).emit('SET_MANIPULATION_QUESTION', question);
                socket.emit('SET_MANIPULATION_QUESTION', question);
                console.log(manipulationRooms[room])
            } else {
                //io.to(room).emit('SHOW_QUESTION_GAP_TEXT', question);
                io.to(room).emit('SET_MANIPULATION_QUESTION', question);
            }
        });

        if(roundCounter[room] > 1){
            questionTimers[room] = startTimerBuzzer(socket);
        }

    }
    // Funktion, um den Timer zu starten
    function startTimerManipulation(socket) {
        const room = getRoomManipulation(socket);
        const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);

        let remainingSeconds = buzzerTimerDuration / 1000; // Gesamte Anzahl von Sekunden

        const timer = setInterval(() => {
            remainingSeconds--; // Reduziere die verbleibenden Sekunden um 1

            
            // Sende die verbleibenden Sekunden an den Client
            io.to(room).emit('BUZZER_TIMER_TICK', remainingSeconds);
/*
            if (remainingSeconds <= 0) {
                const correctAnswer = questions[room].solution;

                clearInterval(timer); // Stoppe den Timer, wenn die Zeit abgelaufen ist
                io.to(otherPlayer).emit('ENABLE_BUZZER');

                socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                io.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id])

                resetRoomQuestion(socket);
            }
                */
        }, 1000); // Wiederhole alle 1000ms (1 Sekunde)

        return timer; // Gib den Timer zurück, um darauf zugreifen zu können
    }
    
    function startGameCountdownManipulation(socket) {
        const room = getRoomManipulation(socket);
        let remainingSeconds = 5;

        const timer = setInterval(() => {
            remainingSeconds--;

            if (remainingSeconds <= 0) {
                clearInterval(timer);

                // Starte den Timer

                io.to(room).emit('MANIPULATION_QUESTION_TYPE', tableGLOBAL[room]);
                //questionTimers[room] = startTimerManipulation(socket);
            }
            console.log("Countdown: " + remainingSeconds);
            io.to(room).emit('MANIPULATION_COUNTDOWN', remainingSeconds);

        }, 1000);
    }


}

module.exports = handleSocketEvents;
