'use strict';

const express = require('express');
const PORT = process.env.PORT || 8080;
const server = express()
  .use(express.static('public'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

// create websocket server
const SocketServer = require('ws').Server;
const wss = new SocketServer({ server });

// create pub/sub broker connection
const stompit = require('stompit');
const stompconnection = {
  host: 'broker-amq-stomp',
  port: 61613,
  connectHeaders: {
    login: process.env.AMQ_USER,
    passcode: process.env.AMQ_PASSWORD
  }
}

stompit.connect(stompconnection, (err, stompclient) => {
  if (err) console.log(err);

  // subscribe to topic on broker and forward any message to websocket clients
  const topic = { destination: '/topic/SampleTopic' }
  stompclient.subscribe(topic, (err, msg) => {
    msg.readString('UTF-8', (err, body) => {
      console.log('sending: %s', body);
      wss.clients.forEach((wsclient) => { wsclient.send(body); });
    });
  });

  // when websocket connection is established...
  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));

    // ...start publishing new messages from websocket to topic on broker
    ws.on('message', (msg) => {
      console.log('received: %s', msg);

      // adjust message here
      var o = JSON.parse(msg);
      o.color = 'green';
      msg = JSON.stringify(o);

      const frame = stompclient.send(topic);
      frame.write(msg);
      frame.end();
    });
  });

  // when the process exits, clean up
  process.on('exit', () => { stompclient.disconnect() });
});
