const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login', // wait, do I have a get users endpoint?
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Instead let's write a simple script connecting directly to Mongo to inspect it.
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/algoarena')
    .then(async () => {
        const users = await mongoose.connection.collection('users').find().toArray();
        console.log("USERS IN DB: ", users.length);
        console.log(users.slice(-2)); // look at the last 2 created
        mongoose.disconnect();
    });
