const express = require('express');
const router = express.Router();
const {Client} = require('pg');
const bcrypt = require('bcrypt');

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
    .then(() => console.log('Rest verbunden mit der PostgreSQL-Datenbank'))
    .catch(err => console.error('Verbindung fehlgeschlagen', err));


router.get("/forgotPassword", (request, response) => {
//TODO SQL Abfrage: select playersecurityquestion, securityquestionresponse from player where email=$1
//oder select playersecurityquestion from player where email=$1
//und select securityquestionresponse from player where email=$1
//falls Abfragen nacheinander erfolgen sollen
//zum pw ändern: update player set playerpassword=$2 where email=$1
});


router.post('/register', (req, res) => {
    const {username, email, password, securityQuestion, securityAnswer} = req.body;

    // Zuerst überprüfen, ob der Benutzername oder die E-Mail bereits existieren
    client.query('SELECT * FROM player WHERE playername = $1 OR email = $2', [username, email], (err, result) => {
        if (err) {
            console.log(err.stack);
            return res.status(500).json({success: false, message: 'Database error'});
        }

        if (result.rows.length > 0) {
            // Wenn ein Benutzer mit dem gleichen Namen oder der gleichen E-Mail existiert
            return res.status(409).json({success: false, message: 'Username or email already exists'});
        }

        // Hashen des Passworts mit bcrypt
        bcrypt.hash(password, 10, (hashErr, hash) => {
            if (hashErr) {
                console.log(hashErr);
                return res.status(500).json({success: false, message: 'Error hashing password'});
            }


            const currentDate = new Date();
            const yesterday = new Date();
            yesterday.setDate(currentDate.getDate() - 1);
            const yesterdayToString = yesterday.toISOString().slice(0, 10);

            // Benutzer existiert nicht, füge neuen Benutzer ein
            client.query('INSERT INTO player (playername, playerpassword, missedstreak, email, playersecurityquestion, securityquestionresponse) values ($1, $2, $3, $4, $5, $6);', [username, hash, yesterdayToString, email, securityQuestion, securityAnswer], (err) => {
                if (err) {
                    console.log(err.stack);
                    return res.status(500).json({success: false, message: 'Database error'});
                }
                res.status(201).json({success: true});
            });
        });

    });
});

router.post('/login', (req, res) => {
    const {username, password} = req.body;

    console.log(username);
    console.log(password);

    // Datenbank SQL
    client.query('SELECT * FROM player WHERE playername = $1', [username], (err, dbRes) => {
        if (err) {
            console.log(err.stack);
            return res.json({success: false});
        } else {
            if (dbRes.rows.length === 0) {
                return res.json({success: false});
            } else {
                const user = dbRes.rows[0];
                if (!user.playerpassword) {
                    // Wenn das playerpassword-Attribut nicht vorhanden ist, sende Misserfolg zurück
                    return res.json({success: false});
                }
                // Vergleiche das eingegebene Passwort mit dem in der Datenbank gespeicherten Hash
                bcrypt.compare(password, user.playerpassword, (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.json({success: false});
                    }
                    if (result) {
                        // Wenn das Passwort korrekt ist, sende Erfolg und Benutzernamen zurück
                        return res.json({success: true, username: username});
                    } else {
                        // Wenn das Passwort falsch ist, sende Misserfolg zurück
                        return res.json({success: false});
                    }
                });
            }
        }
    });
});

router.get('/security-questions', (req, res) => {
    client.query('SELECT unnest(enum_range(null::securityquestion));', (err, dbRes) => {
        if (err) {
            console.error('Fehler beim Ausführen der Abfrage', err);
            res.status(500).json({ error: 'Interner Serverfehler' });
        } else {
            const securityQuestions = dbRes.rows.map(row => row.unnest);

            res.json(securityQuestions);
        }
    });
});



module.exports = router;
