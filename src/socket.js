const functions = require('./functions.js');
const {
    rooms, questions,
    answers,
    playerPoints,
    playerNames,
    playerReady,
    questionTimers,
    playerTurnTimers,
    playerPointsManipulation,
    playerNamesManipulation,
    manipulationRooms,
    playerReadyManipulation,
    hasPlayerFixedCode,
    hasPlayerSubmited,
    hasPlayerFinished,
    changedCode,
    roundEndManipulationCounter
} = require('./constants');

/**
 * Handles socket events for the application.
 * @param {Object} io - The socket.io server instance.
 */
function handleSocketEvents(io) {


    io.on('connection', (socket) => {
        console.log("Socket-Id: " + socket.id);

//---------------------------------------------------------------------------------------------------------------------------------------------//
//------------------------------------------------------< SOCKET FUNCTIONS: Buzzer Game >------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------------------------------------//

        /**
         * Handles the event when a player joins the Buzzer Queue.
         * @param {string} playerName - The name of the player joining the queue.
         */
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
                answers[room] = answers[room] || {};

                io.to(otherPlayer).emit('Buzzer_GameFound', true);
                socket.emit('Buzzer_GameFound', true);

                functions.startGameCountdownBuzzer(socket);
                functions.sendQuestionToClient(socket)

            }
            playerPoints[room][socket.id] = 0;
        });

        /**
         * Handles the event when a player leaves the Buzzer Queue.
         */
        socket.on('Leave_Buzzer_Queue', () => {
            console.log("LEAVE BUZZER QUEUE");

            // Find the room the socket is in
            let room = Object.keys(rooms).find(room => rooms[room].includes(socket.id));

            if (room) {
                // Remove the socket from the room
                rooms[room] = rooms[room].filter(id => id !== socket.id);

                // If the room is now empty, delete it
                if (rooms[room].length === 0) {
                    functions.deleteLobby(room);
                }

                socket.leave(room);
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        });

        /**
         * Handles the request for a daily challenge question.
         */
        socket.on('REQUEST_DAILY_CHALLENGE_QUESTION', () => {
            functions.getGapTextFromDB((question, table) => {
                io.to(socket.id).emit('BUZZER_QUESTION_TYPE', table);
                if (table === "gaptextquestion") {
                    io.to(socket.id).emit('RECEIVE_QUESTION_GAP_TEXT', question);
                } else {
                    io.to(socket.id).emit('RECEIVE_QUESTION_MULTIPLE_CHOICE', question);
                }
            });
        });

        /**
         * Handles the event when a player buzzers in the game.
         */
        socket.on('PLAYER_BUZZERED', () => {
            const room = functions.getRoom(socket);
            if (!room) return;

            // Stoppe den Timer für die Spielrunde
            clearInterval(playerTurnTimers[room]);
            clearInterval(questionTimers[room]);

            const otherPlayer = rooms[room].find(id => id !== socket.id);
            io.to(otherPlayer).emit('DISABLE_BUZZER');


            // Informiere den Gegner, dass der Buzzer zuerst gedrückt wurde
            if (!answers[room][otherPlayer]) {
                io.to(otherPlayer).emit('OPPONENT_BUZZERED');
            }

            // Starte den Timer für den Spielerzug
            playerTurnTimers[room] = functions.startPlayerTurnTimer(socket);
        });


        /**
         * Handles the event when a player compares their answer to the correct answer.
         * @param {string} answer - The answer submitted by the player.
         */
        socket.on('COMPARE_ANSWER', (answer) => {
            const room = functions.getRoom(socket);
            if (!room) return;

            clearInterval(playerTurnTimers[room]);

            //hier muss sichergestellt werden, dass über questions[room].correctAnswer auf die Antwort zugegriffen werden kann
            const correctAnswer = questions[room].solution;
            //answers[room] = answers[room] || {};
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
                functions.resetRoomQuestion(socket);

            } else if (bothAnswered) {  //beide falsch?

                io.to(otherPlayer).emit('ENABLE_BUZZER');
                playerPoints[room][socket.id] -= 1;

                socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                io.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id])
                functions.resetRoomQuestion(socket);

                console.log("BEIDE GEANTWORTET - DEBUGGING")

            } else { //antwort falsch, gegenspieler darf
                playerPoints[room][socket.id] -= 1;
                socket.emit('WRONG_ANSWER');
                io.to(otherPlayer).emit('ENABLE_BUZZER');
                io.to(otherPlayer).emit('OPPONENT_WRONG_ANSWER');
                playerTurnTimers[room] = functions.startPlayerTurnTimer(otherPlayerSocket);
                console.log("FALSCHE ANTWORT -  DEBUGGING")
            }
        });

        /**
         * Handles the event when a player closes the lobby.
         */
        socket.on('CLOSE_LOBBY', () => {
            const room = functions.getRoom(socket);
            if (!room) return;

            functions.deleteLobby(room);

        });

        /**
         * Handles the event when a player disconnects from the manipulation game.
         */
        socket.on('disconnect', () => {
            const room = functions.getRoom(socket);
            console.log(socket + "disconnected.")
            if (room) {
                // Informiere den anderen Spieler im Raum über die Trennung
                const otherPlayer = rooms[room].find(id => id !== socket.id);
                if (otherPlayer) {
                    io.to(otherPlayer).emit('OPPONENT_DISCONNECTED');
                }

                clearInterval(playerTurnTimers[room]);
                clearInterval(questionTimers[room]);

                functions.deleteLobby(room);
                socket.leave(room);
            }

        });


//---------------------------------------------------------------------------------------------------------------------------------------------//
//---------------------------------------------------< SOCKET FUNCTIONS: Manipulation Game >---------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------------------------------------//

        /**
         * Handles the event when a player joins the Manipulation Queue.
         * @param {string} playerName - The name of the player joining the queue.
         */
        socket.on('Manipulation_Queue', (playerName) => {
            console.log("START MANIPULATION QUEUE");

            let roomManipulation = Object.keys(manipulationRooms).find(roomManipulation => manipulationRooms[roomManipulation].length === 1);
            if (!roomManipulation) {
                roomManipulation = `roomManipulation-${socket.id}`;
                manipulationRooms[roomManipulation] = [];
                playerPointsManipulation[roomManipulation] = {};
                playerReadyManipulation[roomManipulation] = {};
                playerNamesManipulation[roomManipulation] = {};
            }

            socket.join(roomManipulation);
            playerNamesManipulation[roomManipulation][socket.id] = playerName;
            manipulationRooms[roomManipulation].push(socket.id);

            if (manipulationRooms[roomManipulation].length === 2) {
                const otherPlayer = manipulationRooms[roomManipulation].find(id => id !== socket.id);
                io.to(otherPlayer).emit('Manipulation_GameFound', true);
                socket.emit('Manipulation_GameFound', true);

                functions.startGameCountdownManipulation(socket);
                functions.sendQuestionToClientManipulation(socket);

            }
            playerPointsManipulation[roomManipulation][socket.id] = 0;
        });

        /**
         * Handles the event when a player leaves the Manipulation Queue.
         */
        socket.on('Leave_Manipulation_Queue', () => {
            console.log("LEAVE MANIPUTLATION QUEUE");

            // Find the room the socket is in
            let room = Object.keys(manipulationRooms).find(room => manipulationRooms[room].includes(socket.id));

            if (room) {
                // Remove the socket from the room
                manipulationRooms[room] = manipulationRooms[room].filter(id => id !== socket.id);

                // If the room is now empty, delete it
                if (manipulationRooms[room].length === 0) {
                    functions.deleteLobby(room);
                }

                socket.leave(room);
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        });

        /**
         * Handles the event when a player submits changes in the manipulation game.
         * @param {Object} data - The changes submitted by the player.
         */
        socket.on('SUBMIT_CHANGES_MANIPULATION', (data) => {
            console.log("SUBMIT CHANGES MANIPULATION");
            const room = functions.getRoomManipulation(socket);
            const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);

            hasPlayerSubmited[room] = hasPlayerSubmited[room] || {};
            changedCode[room] = changedCode[room] || {};
            hasPlayerSubmited[room][socket.id] = true;
            changedCode[room][socket.id] = data;

            // Ensure that `otherPlayer` is correctly identified before emitting
            if (otherPlayer) {
                if (hasPlayerSubmited[room][otherPlayer]) {
                    io.to(socket.id).emit('SWITCH_PAGE_MANIPULATION');
                    io.to(otherPlayer).emit('SWITCH_PAGE_MANIPULATION');

                    // Use setTimeout for a 1-second delay before enabling input manipulation
                    setTimeout(() => {
                        io.to(socket.id).emit('ENABLE_INPUT_MANIPULATION', {
                            code: changedCode[room][otherPlayer].code,
                            answer: changedCode[room][otherPlayer].expectedOutput
                        });
                        io.to(otherPlayer).emit('ENABLE_INPUT_MANIPULATION', {
                            code: changedCode[room][socket.id].code,
                            answer: changedCode[room][socket.id].expectedOutput
                        });
                    }, 1000); // 1000 milliseconds = 1 second
                }
            }
        });

        /**
         * Handles the event when a player adds a point in the manipulation game.
         */
        socket.on('ADD_POINT_MANIPULATION', () => {
            const room = functions.getRoomManipulation(socket);
            playerPointsManipulation[room] = playerPointsManipulation[room] || {};

            playerPointsManipulation[room][socket.id] += 1;
        });


        /**
         * Handles the event when a round ends in the manipulation game.
         * @param {boolean} bool - Indicates whether the player fixed the code or not.
         */
        socket.on('ROUND_END_MANIPULATION', (bool) => {

            const room = functions.getRoomManipulation(socket);
            console.log("ROUND END MANIPULATION");

            roundEndManipulationCounter[room] = (roundEndManipulationCounter[room] || 0)
            console.log(roundEndManipulationCounter[room])
            const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);


            hasPlayerFixedCode[room] = hasPlayerFixedCode[room] || {};
            hasPlayerFixedCode[room][socket.id] = bool;


            hasPlayerFinished[room] = hasPlayerFinished[room] || {};
            hasPlayerFinished[room][socket.id] = true;

            if (otherPlayer) {
                if (hasPlayerFinished[room][otherPlayer]) {
                    if (roundEndManipulationCounter[room] < 2) {
                        roundEndManipulationCounter[room] += 1;
                        console.log("ROUND END MANIPULATION COUNTER: " + roundEndManipulationCounter[room])
                        io.to(socket.id).emit('START_NEW_ROUND_MANIPULATION', playerNamesManipulation[room][otherPlayer], hasPlayerFixedCode[room][socket.id], hasPlayerFixedCode[room][otherPlayer], playerPointsManipulation[room][socket.id], playerPointsManipulation[room][otherPlayer]);
                        io.to(otherPlayer).emit('START_NEW_ROUND_MANIPULATION', playerNamesManipulation[room][socket.id], hasPlayerFixedCode[room][otherPlayer], hasPlayerFixedCode[room][socket.id], playerPointsManipulation[room][otherPlayer], playerPointsManipulation[room][socket.id]);
                        functions.sendQuestionToClientManipulation(socket);

                        console.log("start new round");

                        hasPlayerSubmited[room] = {};
                        hasPlayerFinished[room] = {};
                    } else {
                        console.log(playerNamesManipulation[room][socket.id]);
                        console.log(playerNamesManipulation[room][otherPlayer]);

                        // Lebenspunkte verringern, wenn das Spiel beendet ist
                        if (playerPointsManipulation[room][socket.id] < playerPointsManipulation[room][otherPlayer]) {
                            console.log("decrease lives", playerNamesManipulation[room][socket.id]);
                            functions.decreaseLivesIfNotSubscribed(playerNamesManipulation[room][socket.id]);
                        } else if (playerPointsManipulation[room][otherPlayer] < playerPointsManipulation[room][socket.id]) {
                            console.log("decrease lives", playerNamesManipulation[room][otherPlayer]);
                            functions.decreaseLivesIfNotSubscribed(playerNamesManipulation[room][otherPlayer]);
                        }

                        socket.emit('END_MANIPULATION_GAME', playerPointsManipulation[room][socket.id], playerPointsManipulation[room][otherPlayer]);
                        io.to(otherPlayer).emit('END_MANIPULATION_GAME', playerPointsManipulation[room][otherPlayer], playerPointsManipulation[room][socket.id]);

                        functions.deleteLobby(room);
                    }
                }
            }


        });

//---------------------------------------------------------------------------------------------------------------------------------------------//
//--------------------------------------------------------< SOCKET FUNCTIONS: Testing >--------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------------------------------------//
        /**
         * This is the listener for the automated test
         * */
        socket.on('CONNECTION_TEST', () => {
            console.log("connection test received")
            socket.emit('CONNECTION_TEST_SUCCESSFULLY', true);

        });

    });
}

module.exports = handleSocketEvents;
