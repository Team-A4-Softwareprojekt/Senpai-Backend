const {Client} = require('pg');

// Create a new PostgreSQL client
const client = new Client({
    user: 'lernplattformdb_user',
    host: 'dpg-cotl9a7109ks73an4iug-a.frankfurt-postgres.render.com',
    database: 'lernplattformdb',
    password: 'z46dQYVIYnVeGf19tLgyWCg4g2Uo0u4n',
    port: 5432,
    ssl: true
});

let ioInstance;

/**
 * Initializes the IO instance for socket communication.
 * @param {object} io - The socket.io instance.
 */
function initializeIO(io) {
    ioInstance = io;
}

client.connect(undefined)
    .then(() => console.log('Socket verbunden mit der PostgreSQL-Datenbank'))
    .catch(err => console.error('Verbindung fehlgeschlagen', err));

const {
    rooms,
    questions,
    answers,
    roundCounter,
    playerPoints,
    playerNames,
    playerReady,
    questionTimers,
    playerTurnTimers,
    tableGLOBAL,
    usedQuestionIds,
    playerPointsManipulation,
    playerNamesManipulation,
    manipulationRooms,
    hasPlayerSubmited,
    hasPlayerFinished,
    changedCode,
    roundEndManipulationCounter
} = require('./constants');


//-----------------------------------------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------< ADDITIONAL FUNCTIONS: Buzzer Game >-----------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------------------------------------//
/**
 * Retrieves the room identifier based on the socket ID.
 * @param {object} socket - The socket instance.
 * @returns {string|null} The room identifier if found, otherwise null.
 */
function getRoom(socket) {
    return Object.keys(rooms).find(room => rooms[room].includes(socket.id));
}

/**
 * Fetches a gap text question from the database and invokes a callback with the question data.
 * @param {function} callback - Callback function to handle fetched question data.
 */
function getGapTextFromDB(callback) {
    const selectedTable = 'gaptextquestion';

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

/**
 * Fetches a multiple-choice question from the database and invokes a callback with the question data.
 * @param {function} callback - Callback function to handle fetched question data.
 * @param {string} room - The room identifier.
 */
function getMultipleChoiceFromDB(callback, room) {
    const selectedTable = 'multiplechoicequestion';

    // initialise the set of used question IDs for the room
    if (!usedQuestionIds[room]) {
        usedQuestionIds[room] = new Set();
    }

    // create a string of used question IDs for the query
    const usedIdsArray = Array.from(usedQuestionIds[room]);
    const usedIdsString = usedIdsArray.length > 0 ? usedIdsArray.join(',') : '-1';

    const query = `SELECT *
                       FROM multiplechoicequestion
                       WHERE mcquestionid NOT IN (${usedIdsString})
                       ORDER BY RANDOM() LIMIT 1`;

    client.query(query, (err, result) => {
        if (err) {
            console.error("Error fetching question: ", err);
            return;
        }
        if (result.rows.length > 0) {
            const question = result.rows[0];
            usedQuestionIds[room].add(question.mcquestionid);
            callback(question, selectedTable, room);
        } else {
            console.error("No question found in the database.");
        }
    });
}

/**
 * Sends a question to clients in the specified socket room.
 * @param {object} socket - The socket instance.
 */
function sendQuestionToClient(socket) {
    const room = getRoom(socket);
    if (!room) return;

    roundCounter[room] = (roundCounter[room] || 0) + 1

    getMultipleChoiceFromDB((question, table, room) => {
        questions[room] = question;

        tableGLOBAL[room] = table;

        if (table === "multiplechoicequestion") {
            ioInstance.to(room).emit('SET_BUZZER_QUESTION', question);
        } else {
            ioInstance.to(room).emit('SET_BUZZER_QUESTION', question);
        }
    }, room);

    if (roundCounter[room] > 1) {
        questionTimers[room] = startTimerBuzzer(socket);
    }

}

/**
 * Resets the question and answer state for a room.
 * @param {object} socket - The socket instance.
 */
function resetRoomQuestion(socket) {
    const room = getRoom(socket);

    const otherPlayer = rooms[room].find(id => id !== socket.id);

    questions[room] = null;
    answers[room] = {};
    if (roundCounter[room] < 3) {
        sendQuestionToClient(socket);
    } else {
        ioInstance.to(otherPlayer).emit("END_BUZZER_GAME", playerPoints[room][otherPlayer], playerPoints[room][socket.id])
        socket.emit("END_BUZZER_GAME", playerPoints[room][socket.id], playerPoints[room][otherPlayer])

        // Lebenspunkte verringern, wenn das Spiel beendet ist
        if (playerPoints[room][socket.id] < playerPoints[room][otherPlayer]) {
            decreaseLivesIfNotSubscribed(playerNames[socket.id]);
        } else if (playerPoints[room][otherPlayer] < playerPoints[room][socket.id]) {
            decreaseLivesIfNotSubscribed(playerNames[otherPlayer]);
        }

    }
}

/**
 * Starts a timer for the buzzer game.
 * @param {object} socket - The socket instance.
 * @returns {NodeJS.Timeout} The timer instance.
 */
function startTimerBuzzer(socket) {
    const room = getRoom(socket);
    const otherPlayer = rooms[room].find(id => id !== socket.id);

    // set the duration of the timer based on the round
    let timerDuration;
    if (roundCounter[room] === 1) {
        timerDuration = 20000;
    } else {
        timerDuration = 23000;
    }

    let remainingSeconds = timerDuration / 1000;

    const timer = setInterval(() => {
        remainingSeconds--;

        // send the remaining seconds to the client
        ioInstance.to(room).emit('BUZZER_TIMER_TICK', remainingSeconds);

        if (remainingSeconds <= 0) {
            const correctAnswer = questions[room].solution;

            clearInterval(timer);
            ioInstance.to(otherPlayer).emit('ENABLE_BUZZER');

            socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
            ioInstance.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id])

            resetRoomQuestion(socket);
        }
    }, 1000);

    return timer;
}

/**
 * Starts a timer for player turn in the buzzer game.
 * @param {object} socket - The socket instance.
 * @returns {NodeJS.Timeout} The timer instance.
 */
function startPlayerTurnTimer(socket) {
    const room = getRoom(socket);

    let remainingSeconds = 5;

    const timer = setInterval(() => {
        remainingSeconds--;

        ioInstance.to(room).emit('PLAYER_TURN_TIMER_TICK', remainingSeconds);

        if (remainingSeconds <= 0) {
            clearInterval(timer);

            answers[room][socket.id] = 'empty';
            const otherPlayer = rooms[room].find(id => id !== socket.id);
            const correctAnswer = questions[room].solution;
            const bothAnswered = answers[room][socket.id] && answers[room][otherPlayer];

            if (bothAnswered) { // both players have answered
                ioInstance.to(otherPlayer).emit('ENABLE_BUZZER');
                socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                ioInstance.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id]);
                resetRoomQuestion(socket);
            } else {
                // player did not answer in time, other player gets the chance to answer
                playerPoints[room][socket.id] -= 1;
                socket.emit('WRONG_ANSWER');
                ioInstance.to(otherPlayer).emit('ENABLE_BUZZER');
                ioInstance.to(otherPlayer).emit('OPPONENT_WRONG_ANSWER');

            }
        }
    }, 1000);

    return timer;
}

/**
 * Starts a countdown timer for the game start in the buzzer game.
 * @param {object} socket - The socket instance.
 */
function startGameCountdownBuzzer(socket) {
    const room = getRoom(socket);
    let remainingSeconds = 4;

    const timer = setInterval(() => {
        remainingSeconds--;

        if (remainingSeconds <= 0) {
            clearInterval(timer);

            ioInstance.to(room).emit('BUZZER_QUESTION_TYPE', tableGLOBAL[room]);
            questionTimers[room] = startTimerBuzzer(socket);
        }

        ioInstance.to(room).emit('BUZZER_COUNTDOWN', remainingSeconds);

    }, 1000);
}

/**
 * Decreases player lives if the player is not subscribed.
 * @param {string} playerName - The name of the player.
 * @returns {Promise<void>} A promise that resolves when lives are updated.
 */
async function decreaseLivesIfNotSubscribed(playerName) {
    try {
        const today = new Date();

        const res = await client.query('SELECT lives, subscribed, subenddate FROM player WHERE playername = $1', [playerName]);
        if (res.rows.length > 0) {
            const {lives, subscribed, subenddate} = res.rows[0];
            const subEndDate = new Date(subenddate);
            const remainingTime = Math.ceil((subEndDate - today) / (1000 * 60 * 60 * 24));
            if (remainingTime <= 0 && lives > 0) {
                await client.query('UPDATE player SET lives = lives - 1 WHERE playername = $1 AND lives > 0', [playerName]);
                console.log(`Lives decreased for player: ${playerName}`);
            }
        }
    } catch (err) {
        console.error('Error updating lives:', err);
    }
}

//---------------------------------------------------------------------------------------------------------------------------------------------//
//-------------------------------------------------< ADDITIONAL FUNCTIONS: Manipulation Game >-------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------------------------------------//

/**
 * Retrieves the room identifier for the manipulation game based on the socket ID.
 * @param {object} socket - The socket instance.
 * @returns {string|null} The room identifier if found, otherwise null.
 */
function getRoomManipulation(socket) {
    return Object.keys(manipulationRooms).find(room => manipulationRooms[room].includes(socket.id));
}

/**
 * Fetches two random manipulation questions from the database and invokes a callback with the question data.
 * @param {function} callback - Callback function to handle fetched question data.
 * @param {object} callback.question1 - The first fetched manipulation question.
 * @param {string} callback.table - The name of the table from which the questions were fetched.
 * @param {object} callback.question2 - The second fetched manipulation question.
 */
function getCodeFromDB(callback) {
    const selectedTable = 'manipulation';

    const query = `SELECT *
                       FROM manipulation
                       ORDER BY RANDOM() LIMIT 2`;

    client.query(query, (err, result) => {
        if (err) {
            console.error("Error fetching question: ", err);
            return;
        }
        if (result.rows.length > 0) {
            callback(result.rows[0], selectedTable, result.rows[1]);
        } else {
            console.error("No question found in the database.");
        }
    });
}

/**
 * Fetches manipulation codes from the database and sends them to clients in the specified socket room.
 * @param {object} socket - The socket instance.
 */
function sendQuestionToClientManipulation(socket) {
    const room = getRoomManipulation(socket);
    if (!room) return;

    console.log("sendQuestionToClient");

    getCodeFromDB((question, table, question2) => {
        questions[room] = {question, question2};

        console.log(question);
        console.log(question2);

        tableGLOBAL[room] = table;

        if (table === "manipulation") {
            const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);
            socket.to(otherPlayer).emit('SET_MANIPULATION_QUESTION', question);
            socket.emit('SET_MANIPULATION_QUESTION', question2);

        }
    });
}

/**
 * Starts a countdown timer for the game start in the manipulation game.
 * @param {object} socket - The socket instance.
 */
function startGameCountdownManipulation(socket) {
    const room = getRoomManipulation(socket);
    let remainingSeconds = 4;

    const timer = setInterval(() => {
        remainingSeconds--;

        if (remainingSeconds <= 0) {
            clearInterval(timer);
            ioInstance.to(room).emit('MANIPULATION_QUESTION_TYPE', tableGLOBAL[room]);
        }
        ioInstance.to(room).emit('MANIPULATION_COUNTDOWN', remainingSeconds);

    }, 1000);
}

/**
 * Deletes all data related to a specific lobby/room.
 * @param {string} room - The room identifier.
 */
function deleteLobby(room) {
    console.log("Lobby deleted.")

    delete rooms[room];
    delete questions[room];
    delete answers[room];
    delete roundCounter[room];
    delete playerPoints[room];
    delete playerNames[room];
    delete playerReady[room];
    delete questionTimers[room];
    delete playerTurnTimers[room];
    delete tableGLOBAL[room];
    delete playerPointsManipulation[room];
    delete playerNamesManipulation[room];
    delete manipulationRooms[room];
    delete hasPlayerSubmited[room];
    delete hasPlayerFinished[room];
    delete changedCode[room];
    delete usedQuestionIds[room];
    delete roundEndManipulationCounter[room];
}


//------------------------------------- MODULE EXPORT -------------------------------------//

module.exports = {
    initializeIO,
    getRoom,
    getGapTextFromDB,
    sendQuestionToClient,
    resetRoomQuestion,
    startPlayerTurnTimer,
    startGameCountdownBuzzer,
    getRoomManipulation,
    sendQuestionToClientManipulation,
    startGameCountdownManipulation,
    deleteLobby,
    decreaseLivesIfNotSubscribed
};

