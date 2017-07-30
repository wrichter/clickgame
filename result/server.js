'use strict';

const express = require('express');
const PORT = process.env.PORT || 8080;
const server = express()
  .use(express.static('public'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const SocketServer = require('ws').Server;
const wss = new SocketServer({ server });

const stompit = require('stompit');
const stompconnection = {
  host: 'broker-amq-stomp',
  port: 61613,
  connectHeaders: {
    login: process.env.AMQ_USER,
    passcode: process.env.AMQ_PASSWORD
  }
}
const topic = { destination: '/topic/SampleTopic' };

stompit.connect(stompconnection, (err, stompclient) => {
  if (err) console.log(err);

  //subscribe to topic and send to all websocket clients
  stompclient.subscribe(topic, (err, msg) => {
    msg.readString('UTF-8', (err, body) => {
      console.log('sending: %s', body);
      wss.clients.forEach((websocketclient) => { websocketclient.send(body); });
    });
  });

  //publish new messages from websocket to topic
  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
    ws.on('message', function incoming(msg) {
      console.log('received: %s', msg);

      // adjust message here
      var o = JSON.parse(msg);
      o.color = 'blue';
      msg = JSON.stringify(o);

      const frame = stompclient.send(topic);
      frame.write(msg);
      frame.end();
    });
  });

  //cleanup on exit
  process.on('exit', function () {
    stompclient.disconnect();
  });
});
