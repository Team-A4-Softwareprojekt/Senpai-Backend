const express = require('express');
const router = express.Router();
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
    .then(() => console.log('Verbunden mit der PostgreSQL-Datenbank'))
    .catch(err => console.error('Verbindung fehlgeschlagen', err));


router.get("/forgotPassword", (request, response) => {

});

router.get("/registration", (request, response) => {
    //Datenbank SQL

    response.send('Registration');
});


router.get("/login", (request, response) => {
    const username = request.query.username;
    const password = request.query.password;
    console.log(username);
    console.log(password);

    // Datenbank SQL
    client.query('SELECT * FROM player WHERE playername = $1 AND passwort = $2', [username, password], (err, res) => {
        if (err) {
            console.log(err.stack);
            response.send(false);
        } else {
            if (res.rows.length === 0) {
                response.send(false);
            }
            else {
                response.send(true);
            }
        }
    });
});


module.exports = router;
