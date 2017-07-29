'use strict';

const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 8080;
const INDEX = path.join(__dirname, 'index.html');

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const SocketServer = require('ws').Server;
const stompit = require('stompit');
const topic = { destination: '/topic/SampleTopic' };
const wss = new SocketServer({ server });

stompit.connect({ host: 'broker-amq-stomp', port: 61613, connectHeaders:{
    'host': '/', login: process.env.AMQ_USER , passcode: process.env.AMQ_PASSWORD }}, (err, stompclient) => {
  console.log(err);
  stompclient.subscribe(topic, (err, msg) => {
    msg.readString('UTF-8', (err, body) => {
      console.log('sending: %s', body);
      wss.clients.forEach((websocketclient) => { websocketclient.send(body); });
    });
  });

  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
    ws.on('message', function incoming(msg) {
      console.log('received: %s', msg);
      const frame = stompclient.send(topic);
      frame.write(msg);
      frame.end();
    });
  });

  process.on('exit', function () { //on 'SIGTERM'
    wss.clients.forEach((websocketclient) => { websocketclient.send(msg); });
    stompclient.disconnect();
  });
});
