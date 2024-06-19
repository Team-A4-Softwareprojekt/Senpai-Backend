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

router.get("/connection_test", (request, response) => {
    const testdata = request.query.data;
    console.log(testdata);
    if(testdata === "TEST"){
        response.send(true);
    }else{
        response.send(false);
    }

})

router.post('/loadAccountData', (request, response) => {
    const { playerName } = request.body; // Hier sollte request.body verwendet werden
    console.log(request.body);

    client.query('SELECT * FROM player WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.log(err.stack);
            response.status(500).send({ success: false, message: 'Database query error' }); // Senden einer JSON-Antwort
        } else {
            if (res.rows.length === 0) {
                response.status(404).send({ success: false, message: 'Player not found' }); // Senden einer JSON-Antwort
            } else {
                response.status(200).send(res.rows[0]); // Senden des Spieler-Datensatzes als JSON-Antwort
                console.log(res.rows[0]);
            }
        }
    });
});

router.post('/changeEmail', (request, response) => {
    const { playerName, newEmail } = request.body;
    console.log(request.body);

    // Update the player's email in the database
    client.query('UPDATE player SET email = $1 WHERE playername = $2', [newEmail, playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Player not found' });
        }

        response.status(200).json({ success: true, message: 'Email updated successfully' });
    });
});

router.post('/changePassword', async (request, response) => {
    const {playerName, newPassword} = request.body;
    console.log(request.body);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    client.query('UPDATE player SET playerpassword = $1 WHERE playername = $2', [hashedPassword, playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({success: false, message: 'Database query error'});
        }

        if (res.rowCount === 0) {
            return response.status(404).json({success: false, message: 'Player not found'});
        }

        response.status(200).json({success: true, message: 'Password updated successfully'});

    });
});

function setEndDateSubscription(playerName) {
    client.query('UPDATE player SET subenddate = CURRENT_DATE + INTERVAL \'30 days\' WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);

        }

        if (res.rowCount === 0) {
            console.error('SUBENDDATE: Player could not be found');
        }
    });
}

router.post('/startSubscription', (request, response) => {
    const {playerName, subEndDate} = request.body;
    console.log(request.body);

    client.query('UPDATE player SET subscribed = true, credit = credit-5, subenddate = $2 WHERE playername = $1 AND credit >= 5', [playerName, subEndDate], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Your credit is not sufficient.' });
        }

        //setEndDateSubscription(playerName);
        response.status(200).json({ success: true, message: 'successfully subscribed!' });
    });
});

router.post('/deleteAccount', (request, response) => {
    const {playerName} = request.body;

    client.query('DELETE FROM player WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Player not found' });
        }

        response.status(200).json({ success: true, message: 'Your Account has been successfully deleted!' });
    });
});

router.post('/forgotPassword', async (request, response) => {
    const {email, newPassword, safetyQuestion, safetyAnswer} = request.body;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    client.query('UPDATE player SET password = $1 WHERE email = $2 AND playersecurityquestion = $3 AND securityquestionresponse = $4', [hashedPassword, email, safetyQuestion, safetyAnswer], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({success: false, message: 'Database query error'});
        }

        if (res.rowCount === 0) {
            return response.status(404).json({success: false, message: 'Please check the provided information.'});
        }

        response.status(200).json({success: true, message: 'successfully subscribed!'});
    });
});

router.post('/cancelSubscription', (request, response) => {

    const {playerName} = request.body;

    client.query('UPDATE player SET subscribed = false WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Your credit is not sufficient.' });
        }

        response.status(200).json({ success: true, message: 'successfully unsubscribed!' });
    });
});

router.post('/buyCurrency', (request, response) => {

    const {playerName, amount} = request.body;

    client.query('UPDATE player SET credit = credit + $1 WHERE playername = $2', [amount, playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Player not found' });
        }

        response.status(200).json({ success: true, message: 'successfully increased your credit!' });
    });
});

module.exports = router;
