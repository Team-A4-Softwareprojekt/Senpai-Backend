const rooms = {}; // Stores rooms and players in each room

const questions = {}; // Stores current questions per room
const answers = {}; // Stores player answers per room
const roundCounter = {}; // Counts calls to AWAIT_QUESTION per room
const playerPoints = {}; // Stores player points in a lobby
const playerNames = {}; // Stores player names per room
const playerReady = {}; // Stores player readiness per room
const questionTimers = {}; // Stores timers for questions per room
const playerTurnTimers = {}; // Stores timers for player turns per room
const tableGLOBAL = {}; // Stores tables per room
const usedQuestionIds = {}; // Stores IDs of questions already asked

const playerPointsManipulation = {}; // Stores player points in a lobby
const playerNamesManipulation = {}; // Stores player names per room
const manipulationRooms = {}; // Stores rooms and players in each room
const playerReadyManipulation = {}; // Stores player readiness per room

const hasPlayerFixedCode = {}; // Stores whether a player has fixed their code
const hasPlayerSubmited = {}; // Stores whether a player has submitted their changes
const hasPlayerFinished = {}; // Stores whether a player has finished the round
const changedCode = {}; // Stores the changed code
const roundEndManipulationCounter = {}; // Counts rounds in manipulation mode

module.exports = {
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
    playerReadyManipulation,
    hasPlayerFixedCode,
    hasPlayerSubmited,
    hasPlayerFinished,
    changedCode,
    roundEndManipulationCounter
};
