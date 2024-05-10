/*
const { io } = require("socket.io-client");
const {createInterface} = require("readline");

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('message', (data) => {
    console.log('Message from server: ' + data);
});

//Hier wird ein Button für eine Registrierung gedrückt
socket.on('registration_success', (registration_success) => {
    console.log('Registration success: ' + registration_success);
});

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    socket.emit('message', input);
});

//Aufruf Übergabe der Daten für die Registrierung
socket.emit('registration', 'Username', 'Password');

*/


const express = require('express');
//const {response} = require("express");
const app = express();


fetch('http://localhost:3000/registration')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text(); // Die Antwort als Text lesen
    })
    .then(data => {
        console.log('Response from server:', data); // Anzeige der Antwort in der Konsole
        // Hier kannst du die Antwort in deiner Anwendungslogik weiterverarbeiten oder anzeigen
    })
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
    });