/*
* This File is for testing purposes only. The Github Actions Workflow will run this file on every push/pull_request.
* For more Details navigate to .github/workflows/node.js.yml
* */

const { exec } = require('child_process');

const server = exec('node ./src/server.js');

server.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

server.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
    process.exit(1);
});

server.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code); // Beenden Sie den Prozess mit dem Exit-Code des Servers
});

// Stop the server after 5 seconds
setTimeout(() => {
    server.kill();
    console.log('Test Run Complete: Server stopped');
    process.exit(0);
}, 5000);
