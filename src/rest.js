const express = require('express');
const router = express.Router();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Connection information
const client = new Client({
    user: 'lernplattformdb_user',
    host: 'dpg-cotl9a7109ks73an4iug-a.frankfurt-postgres.render.com',
    database: 'lernplattformdb',
    password: 'z46dQYVIYnVeGf19tLgyWCg4g2Uo0u4n',
    port: 5432, // Standard port for PostgreSQL
    ssl: true
});

client.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Connection failed', err));

/**
 * @api {post} /register Register a new user and save it in the database
 * @apiName RegisterUser
 * @apiGroup User
 *
 * @apiParam {String} username Username of the user.
 * @apiParam {String} email Email of the user.
 * @apiParam {String} password Password of the user.
 * @apiParam {String} securityQuestion Security question for password recovery.
 * @apiParam {String} securityAnswer Answer to the security question.
 *
 * @apiSuccess {Boolean} success Indicates if the registration was successful.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/register', (req, res) => {
    const { username, email, password, securityQuestion, securityAnswer } = req.body;

    // Check if the username or email already exists
    client.query('SELECT * FROM player WHERE playername = $1 OR email = $2', [username, email], (err, result) => {
        if (err) {
            console.log(err.stack);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (result.rows.length > 0) {
            // If a user with the same name or email exists
            return res.status(409).json({ success: false, message: 'Username or email already exists' });
        }

        // Hash the password with bcrypt
        bcrypt.hash(password, 10, (hashErr, hash) => {
            if (hashErr) {
                console.log(hashErr);
                return res.status(500).json({ success: false, message: 'Error hashing password' });
            }

            const currentDate = new Date();
            const yesterday = new Date();
            yesterday.setDate(currentDate.getDate() - 1);
            const yesterdayToString = yesterday.toISOString().slice(0, 10);

            // User does not exist, insert new user
            client.query('INSERT INTO player (playername, playerpassword, missedstreak, email, playersecurityquestion, securityquestionresponse) values ($1, $2, $3, $4, $5, $6);', [username, hash, yesterdayToString, email, securityQuestion, securityAnswer], (err) => {
                if (err) {
                    console.log(err.stack);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.status(201).json({ success: true });
            });
        });

    });
});

/**
 * @api {post} /login Login a user
 * @apiName LoginUser
 * @apiGroup User
 *
 * @apiParam {String} username Username of the user.
 * @apiParam {String} password Password of the user.
 *
 * @apiSuccess {Boolean} success Indicates if the login was successful.
 * @apiSuccess {Object} data User data if login was successful.
 */
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    console.log(username);
    console.log(password);

    // Database SQL
    client.query('SELECT * FROM player WHERE playername = $1', [username], (err, dbRes) => {
        if (err) {
            console.log(err.stack);
            return res.json({ success: false });
        } else {
            if (dbRes.rows.length === 0) {
                return res.json({ success: false });
            } else {
                const user = dbRes.rows[0];

                if (!user.playerpassword) {
                    // If the playerpassword attribute is not present, return failure
                    return res.json({ success: false });
                }
                // Compare the entered password with the hash stored in the database
                bcrypt.compare(password, user.playerpassword, (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.json({ success: false });
                    }
                    if (result) {
                        // If the password is correct, return success and username
                        return res.json({ success: true, data: user });
                    } else {
                        // If the password is incorrect, return failure
                        return res.json({ success: false });
                    }
                });
            }
        }
    });
});

/**
 * @api {get} /security-questions Get security questions
 * @apiName GetSecurityQuestions
 * @apiGroup User
 *
 * @apiSuccess {Array} securityQuestions List of security questions.
 */
router.get('/security-questions', (req, res) => {
    client.query('SELECT unnest(enum_range(null::securityquestion));', (err, dbRes) => {
        if (err) {
            console.error('Error executing query', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            const securityQuestions = dbRes.rows.map(row => row.unnest);
            res.json(securityQuestions);
        }
    });
});

/**
 * @api {get} /connection_test Test connection
 * @apiName ConnectionTest
 * @apiGroup Misc
 *
 * @apiParam {String} data Test data.
 *
 * @apiSuccess {Boolean} Indicates if the connection test was successful.
 */
router.get("/connection_test", (request, response) => {
    const testdata = request.query.data;
    console.log(testdata);
    if (testdata === "TEST") {
        response.send(true);
    } else {
        response.send(false);
    }
});

/**
 * @api {post} /loadAccountData Load account data
 * @apiName LoadAccountData
 * @apiGroup User
 *
 * @apiParam {String} playerName Username of the player.
 *
 * @apiSuccess {Object} User data if found.
 */
router.post('/loadAccountData', (request, response) => {
    const { playerName } = request.body;
    console.log(request.body);

    client.query('SELECT * FROM player WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.log(err.stack);
            response.status(500).send({ success: false, message: 'Database query error' });
        } else {
            if (res.rows.length === 0) {
                response.status(404).send({ success: false, message: 'Player not found' });
            } else {
                response.status(200).send(res.rows[0]);
                console.log(res.rows[0]);
            }
        }
    });
});

/**
 * @api {post} /changeEmail Change user email
 * @apiName ChangeEmail
 * @apiGroup User
 *
 * @apiParam {String} playerName Username of the player.
 * @apiParam {String} newEmail New email address.
 *
 * @apiSuccess {Boolean} success Indicates if the email was changed successfully.
 * @apiSuccess {String} message Success or error message.
 */
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

/**
 * @api {post} /changePassword Change user password
 * @apiName ChangePassword
 * @apiGroup User
 *
 * @apiParam {String} playerName Username of the player.
 * @apiParam {String} newPassword New password.
 *
 * @apiSuccess {Boolean} success Indicates if the password was changed successfully.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/changePassword', async (request, response) => {
    const { playerName, newPassword } = request.body;
    console.log(request.body);

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the player's password in the database
        client.query('UPDATE player SET playerpassword = $1 WHERE playername = $2', [hashedPassword, playerName], (err, res) => {
            if (err) {
                console.error('Error executing query', err.stack);
                return response.status(500).json({ success: false, message: 'Database query error' });
            }

            if (res.rowCount === 0) {
                return response.status(404).json({ success: false, message: 'Player not found' });
            }

            response.status(200).json({ success: true, message: 'Password updated successfully' });
        });
    } catch (error) {
        console.error('Error hashing password', error);
        response.status(500).json({ success: false, message: 'Error hashing password' });
    }
});

/**
 * @api {post} /startSubscription Start a subscription
 * @apiName StartSubscription
 * @apiGroup Subscription
 *
 * @apiParam {String} playerName Username of the player.
 * @apiParam {String} subEndDate End date of the subscription.
 *
 * @apiSuccess {Boolean} success Indicates if the subscription was started successfully.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/startSubscription', (request, response) => {
    const { playerName, subEndDate } = request.body;
    console.log(request.body);

    // Update the player's subscription status in the database
    client.query('UPDATE player SET subscribed = true, credit = credit-5, subenddate = $2 WHERE playername = $1 AND credit >= 5', [playerName, subEndDate], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Your credit is not sufficient.' });
        }

        response.status(200).json({ success: true, message: 'Successfully subscribed!' });
    });
});

/**
 * @api {post} /deleteAccount Delete user account
 * @apiName DeleteAccount
 * @apiGroup User
 *
 * @apiParam {String} playerName Username of the player.
 *
 * @apiSuccess {Boolean} success Indicates if the account was deleted successfully.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/deleteAccount', (request, response) => {
    const { playerName } = request.body;

    // Delete the player's account from the database
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

/**
 * @api {post} /forgotPassword Reset user password
 * @apiName ForgotPassword
 * @apiGroup User
 *
 * @apiParam {String} email Email of the player.
 * @apiParam {String} password New password.
 * @apiParam {String} securityQuestion Security question for password recovery.
 * @apiParam {String} securityAnswer Answer to the security question.
 *
 * @apiSuccess {Boolean} success Indicates if the password was reset successfully.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/forgotPassword', async (request, response) => {
    const { email, password, securityQuestion, securityAnswer } = request.body;
    console.log(request.body);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update the player's password in the database based on email and security question
        client.query('UPDATE player SET playerpassword = $1 WHERE email = $2 AND playersecurityquestion = $3 AND securityquestionresponse = $4', [hashedPassword, email, securityQuestion, securityAnswer], (err, res) => {
            if (err) {
                console.error('Error executing query', err.stack);
                return response.status(500).json({ success: false, message: 'Database query error' });
            }

            if (res.rowCount === 0) {
                return response.status(404).json({ success: false, message: 'Please check the provided information.' });
            }

            response.status(200).json({ success: true, message: 'Password changed successfully!' });
        });
    } catch (error) {
        console.error('Error hashing password', error);
        response.status(500).json({ success: false, message: 'Error hashing password' });
    }
});

/**
 * @api {post} /cancelSubscription Cancel user subscription
 * @apiName CancelSubscription
 * @apiGroup Subscription
 *
 * @apiParam {String} playerName Username of the player.
 *
 * @apiSuccess {Boolean} success Indicates if the subscription was cancelled successfully.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/cancelSubscription', (request, response) => {
    const { playerName } = request.body;

    // Update the player's subscription status to false in the database
    client.query('UPDATE player SET subscribed = false WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Your credit is not sufficient.' });
        }

        response.status(200).json({ success: true, message: 'Successfully unsubscribed!' });
    });
});

/**
 * @api {post} /buyCurrency Buy currency for user
 * @apiName BuyCurrency
 * @apiGroup Currency
 *
 * @apiParam {String} playerName Username of the player.
 * @apiParam {Number} amount Amount of currency to buy.
 *
 * @apiSuccess {Boolean} success Indicates if the currency purchase was successful.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/buyCurrency', (request, response) => {
    const { playerName, amount } = request.body;

    // Update the player's credit in the database by adding the specified amount
    client.query('UPDATE player SET credit = credit + $1 WHERE playername = $2', [amount, playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Player not found' });
        }

        response.status(200).json({ success: true, message: 'Successfully increased your credit!' });
    });
});

/**
 * @api {post} /streakForToday Mark streak completion for today
 * @apiName StreakForToday
 * @apiGroup User
 *
 * @apiParam {String} playerName Username of the player.
 *
 * @apiSuccess {Boolean} success Indicates if the streak was marked successfully.
 * @apiSuccess {String} message Success or error message.
 */
router.post('/streakForToday', (request, response) => {
    const { playerName } = request.body;

    // Update the player's streaktoday flag to true in the database
    client.query('UPDATE player SET streaktoday = true WHERE playername = $1', [playerName], (err, res) => {
        if (err) {
            console.error('Error executing query', err.stack);
            return response.status(500).json({ success: false, message: 'Database query error' });
        }

        if (res.rowCount === 0) {
            return response.status(404).json({ success: false, message: 'Player not found' });
        }

        response.status(200).json({ success: true, message: 'Great job, you completed the daily challenge!' });
    });
});

module.exports = router;

