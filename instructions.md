# Instructions

## Instantiate clickgame in namespace
    $ oc new-project clickgame
    $ oc process -f clickgame.yaml | oc create -f -

## Demonstrate App structure
* **server.js** is a simple express application to serve static content
* **public/index.html** is the static HTML page being served

## Adjust client (index.html)
1. Replace the &lt;h1> element with the following snippet:

```&lt;div id="status">&lt;/div>
&lt;canvas id="canvas">&lt;/canvas>
&lt;script>
  var statusline = document.getElementById('status');
  var numconnections = 0;

  var canvas = document.getElementById('canvas');
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;
  var context = canvas.getContext('2d');

  function init(url){
    statusline.innerHTML = "connecting..."
    ws = new WebSocket(url);

  }
  init('ws://' + window.location.host + '/')
&lt;/script>```

-2-
//send coordinates to server on click/tap
function click(e) {
  ws.send(JSON.stringify({ x: e.clientX, y: e.clientY }));
}
canvas.addEventListener("mouseup", click, false);

-3-
//draw circle upon message from server
ws.onmessage = function(event) {
  statusline.innerHTML = 'connection #' + numconnections + ' ' +  event.data
  var msg = JSON.parse(event.data);
  context.beginPath();
  context.arc(msg.x, msg.y, msg.radius || 20, 0, 2 * Math.PI, false);
  context.fillStyle = msg.color || 'green';
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = '#003300';
  context.stroke();
};

-4-
//reconnect to server upon connection loss
ws.onerror = function(){
  canvas.removeEventListener("mouseup", click, false);
  setTimeout(function(){ init(url) }, 1000);
};

//close & reconnect web socket after 10 seconds
ws.onopen = function() {
  statusline.innerHTML = 'connection #' + ++numconnections
  setTimeout(function() {
    canvas.removeEventListener("mouseup", click, false);
    ws.close();
    init(url);
  }, 10000)
}


--- SERVER ---
-1-
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

  // additional code here
});


-2-
//subscribe to topic and send to all websocket clients
stompclient.subscribe(topic, (err, msg) => {
  msg.readString('UTF-8', (err, body) => {
    console.log('sending: %s', body);
    wss.clients.forEach((websocketclient) => { websocketclient.send(body); });
  });
});

-3-
//publish new messages from websocket to topic
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
  ws.on('message', function incoming(msg) {
    console.log('received: %s', msg);

    // adjust message here

    const frame = stompclient.send(topic);
    frame.write(msg);
    frame.end();
  });
});


-4-
//cleanup on exit
process.on('exit', function () { //on 'SIGTERM'
  stompclient.disconnect();
});

-5-
var o = JSON.parse(msg);
o.color = 'blue';
msg = JSON.stringify(o);
