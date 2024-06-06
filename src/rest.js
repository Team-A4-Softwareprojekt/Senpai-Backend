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
    .then(() => console.log('Rest verbunden mit der PostgreSQL-Datenbank'))
    .catch(err => console.error('Verbindung fehlgeschlagen', err));


router.get("/forgotPassword", (request, response) => {
//TODO SQL Abfrage: select playersecurityquestion, securityquestionresponse from player where email=$1
//oder select playersecurityquestion from player where email=$1
//und select securityquestionresponse from player where email=$1
//falls Abfragen nacheinander erfolgen sollen
//zum pw ändern: update player set playerpassword=$2 where email=$1
});

router.get("/registration", (request, response) => {
    //Datenbank SQL
    const username = request.query.username;
    const password = request.query.password;
    const email = request.query.email;    
    console.log(username);
    console.log(password);
    console.log(email);

    // TODO: needs to be tested
    client.query('SELECT * FROM player WHERE playername = $1 or email = $2 ;', [username, email],(err, res) => {
        if(err){
            console.log(err.stack);
            response.send(false);
        }else{
            if(res.rows.length === 0){
                const currentDate = new Date();
                const yesterday = new Date();
                yesterday.setDate(currentDate.getDate()-1);
                const yesterdayToString = yesterday.toISOString().slice(0,10);
                client.query('INSERT INTO player (playername, playerpassword, rank, subscribed, streaktoday,missedstreak, playablegames, email) values ($1, $2, 1, false, false, $3, 3, $4);', [username, password, yesterdayToString, email]);
                console.log(true);            
            }else{
                console.log(false);
            }
        }
    })

    response.send('Registration');
});


router.get("/login", (request, response) => {
    const username = request.query.username;
    const password = request.query.password;
    console.log(username);
    console.log(password);

    // Datenbank SQL
    client.query('SELECT * FROM player WHERE playername = $1 AND playerpassword = $2', [username, password], (err, res) => {
        if (err) {
            console.log(err.stack);
            response.send(false);
        } else {
            if (res.rows.length === 0) {
                response.send(false);
            }
            else {
                response.send({ success: true, username: username });
            }
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

module.exports = router;
