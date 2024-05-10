const express = require('express');
const router = express.Router();

router.get("/registration", (request, response) => {
    //Datenbank SQL
    response.send('Registration');
});

module.exports = router;