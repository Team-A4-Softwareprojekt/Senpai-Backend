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

let ioInstance;

function initializeIO(io) {
    ioInstance = io; // io-Instanz setzen
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

function getMultipleChoiceFromDB(callback, room) {
    const selectedTable = 'multiplechoicequestion';
    console.log(selectedTable);

    // Initialisiere usedQuestionIds für den Raum, falls noch nicht vorhanden
    if (!usedQuestionIds[room]) {
        usedQuestionIds[room] = new Set();
    }

    // Erstelle die Liste der bereits verwendeten Frage-IDs für den Raum
    const usedIdsArray = Array.from(usedQuestionIds[room]);
    const usedIdsString = usedIdsArray.length > 0 ? usedIdsArray.join(',') : '-1';

    // Query basierend auf der ausgewählten Tabelle erstellen
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
            console.log("Selected question ID:", question.mcquestionid);
            usedQuestionIds[room].add(question.mcquestionid);
            console.log("Used question IDs for room", room, ":", Array.from(usedQuestionIds[room]));
            callback(question, selectedTable, room);
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

    getMultipleChoiceFromDB((question, table, room) => {
        questions[room] = question;

        tableGLOBAL[room] = table;

        if (table === "multiplechoicequestion") {
            //io.to(room).emit('SHOW_QUESTION_MULTIPLE_CHOICE', question);
            ioInstance.to(room).emit('SET_BUZZER_QUESTION', question);
            console.log(rooms[room])
        } else {
            //io.to(room).emit('SHOW_QUESTION_GAP_TEXT', question);
            ioInstance.to(room).emit('SET_BUZZER_QUESTION', question);
        }
    }, room);

    if (roundCounter[room] > 1) {
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

// Funktion, um den Timer zu starten
function startTimerBuzzer(socket) {
    const room = getRoom(socket);
    const otherPlayer = rooms[room].find(id => id !== socket.id);

    // Bestimmen Sie die Dauer des Timers basierend auf der Rundenanzahl
    let timerDuration;
    if (roundCounter[room] === 1) {
        timerDuration = 20000; // 20 Sekunden für die erste Runde
    } else {
        timerDuration = 23000; // 23 Sekunden für alle anderen Runden
    }

    let remainingSeconds = timerDuration / 1000; // Gesamte Anzahl von Sekunden

    const timer = setInterval(() => {
        remainingSeconds--; // Reduziere die verbleibenden Sekunden um 1

        // Sende die verbleibenden Sekunden an den Client
        ioInstance.to(room).emit('BUZZER_TIMER_TICK', remainingSeconds);

        if (remainingSeconds <= 0) {
            const correctAnswer = questions[room].solution;

            clearInterval(timer); // Stoppe den Timer, wenn die Zeit abgelaufen ist
            ioInstance.to(otherPlayer).emit('ENABLE_BUZZER');

            socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
            ioInstance.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id])

            resetRoomQuestion(socket);
        }
    }, 1000); // Wiederhole alle 1000ms (1 Sekunde)

    return timer; // Gib den Timer zurück, um darauf zugreifen zu können
}

// Funktion, um den Timer für den Spielerzug zu starten
function startPlayerTurnTimer(socket) {
    const room = getRoom(socket);

    //answers[room] = answers[room] || {};

    let remainingSeconds = 5; // Anzahl von Sekunden für den Spielerzug

    const timer = setInterval(() => {
        remainingSeconds--; // Reduziere die verbleibenden Sekunden um 1

        // Sende die verbleibenden Sekunden an den Client
        ioInstance.to(room).emit('PLAYER_TURN_TIMER_TICK', remainingSeconds);

        if (remainingSeconds <= 0) {
            clearInterval(timer); // Stoppe den Timer, wenn die Zeit abgelaufen ist

            answers[room][socket.id] = 'empty';
            const otherPlayer = rooms[room].find(id => id !== socket.id);
            const correctAnswer = questions[room].solution;
            const bothAnswered = answers[room][socket.id] && answers[room][otherPlayer];

            // Hier die angepasste Logik bei Ablauf des Timers
            if (bothAnswered) {
                // beide haben falsch geantwortet
                ioInstance.to(otherPlayer).emit('ENABLE_BUZZER');
                socket.emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][socket.id], playerPoints[room][otherPlayer]);
                ioInstance.to(otherPlayer).emit('END_ROUND', "unentschieden", correctAnswer, playerPoints[room][otherPlayer], playerPoints[room][socket.id]);
                resetRoomQuestion(socket);
            } else {
                // aktueller Spieler hat falsch geantwortet, der andere Spieler darf
                playerPoints[room][socket.id] -= 1;
                socket.emit('WRONG_ANSWER');
                ioInstance.to(otherPlayer).emit('ENABLE_BUZZER');
                ioInstance.to(otherPlayer).emit('OPPONENT_WRONG_ANSWER');

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

            ioInstance.to(room).emit('BUZZER_QUESTION_TYPE', tableGLOBAL[room]);
            questionTimers[room] = startTimerBuzzer(socket);
        }

        ioInstance.to(room).emit('BUZZER_COUNTDOWN', remainingSeconds);

    }, 1000);
}


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


function getRoomManipulation(socket) {
    return Object.keys(manipulationRooms).find(room => manipulationRooms[room].includes(socket.id));
}

function getCodeFromDB(callback) {
    const selectedTable = 'manipulation';

    console.log(selectedTable);

    // Query basierend auf der ausgewählten Tabelle erstellen
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
            console.log(manipulationRooms[room]);
            const otherPlayer = manipulationRooms[room].find(id => id !== socket.id);
            // Sende 'ENABLE_INPUT_MANIPULATION' an den anderen Spieler
            socket.to(otherPlayer).emit('SET_MANIPULATION_QUESTION', question);
            socket.emit('SET_MANIPULATION_QUESTION', question2);

        }
    });
}

function startGameCountdownManipulation(socket) {
    const room = getRoomManipulation(socket);
    let remainingSeconds = 4;

    const timer = setInterval(() => {
        remainingSeconds--;

        if (remainingSeconds <= 0) {
            clearInterval(timer);

            // Starte den Timer
            ioInstance.to(room).emit('MANIPULATION_QUESTION_TYPE', tableGLOBAL[room]);
            //questionTimers[room] = startTimerManipulation(socket);
        }
        console.log("Countdown: " + remainingSeconds);
        ioInstance.to(room).emit('MANIPULATION_COUNTDOWN', remainingSeconds);

    }, 1000);
}

function deleteLobby(room) {
    console.log("Lobby deleted.")

    delete rooms[room];
    delete questions[room];
    delete answers[room];
    delete roundCounter[room];
    delete playerPoints[room];
    delete playerNames[room];
    delete playerReady[room];
    delete questionTimers[room]; // Speichert die Timer für die Fragen pro Raum
    delete playerTurnTimers[room]; // Speichert die Timer für die Spielerzüge pro Raum
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

