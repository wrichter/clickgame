# Instructions

## Instantiate clickgame in namespace
```
$ oc new-project clickgame
$ oc process -f clickgame.yaml | oc create -f -
```

## Demonstrate App structure
* **server.js** is a simple express application to serve static content,
containing some javascript code to draw a circle on a canvas.
* **public/index.html** is the static HTML page being served

## Adjust client (index.html)
Executing these changes will yield [result/index.html](result/index.html).

1. Remove the &lt;h1> element
2. Add to the JavaScript to open a web socket back to the server:
```
function connect(url, oldws) {
  statusline.innerHTML = "connecting..."
  var ws = new WebSocket(url);

  //additional code here
}
connect('ws://' + window.location.host + '/')
```

2. Send click coordinates to the server
(add everything in the connect function, after ```//additional code here ``` ):
```
//send coordinates to server on click/tap
function click(e) {
  ws.send(JSON.stringify({ x: e.clientX, y: e.clientY }));
}
```

3. When message is received via websocket,
draw a circle with the specified coordinates, radius and color:
```
//draw circle upon message from server
ws.onmessage = function(event) {
  statusline.innerHTML = 'connection #' + numconns + ' ' + event.data;
  var msg = JSON.parse(event.data);
  circle(msg.x, msg.y, msg.radius || 20, msg.color || 'blue');
};
```

4. Create function to reconnect web socket:
```
//function to reconnect web socket
function reconnectafter(msec) {
  clearTimeout(reconnecttimeout);
  reconnecttimeout = setTimeout(() => { connect(url, ws) }, msec);
}
```

5. When socket is opened successfully:
notify user,
add event handler to handle clicks,
set timeout to reconnect after 10 seconds and
close old socket if necessary
```
//set status message, register click handler and close old socket
ws.onopen = function() {
  statusline.innerHTML = 'connection #' + ++numconns;
  canvas.addEventListener("mouseup", click, false);
  reconnectafter(10000);
  if (oldws) oldws.close();
}
```

6. Remove mouseup handler when connection is closed
```
//remove mouseup handler when connection is closed
ws.onclose = function() {
  canvas.removeEventListener("mouseup", click, false);
};
```

7. Reconnect to server upon connection loss with 1 sec delay
```
//reconnect to server upon connection loss with 1 sec delay
ws.onerror = function() {
  reconnectafter(1000);
};
```

## Adjust server (server.js)
Executing these changes will yield [result/server.js](result/server.js).

1. Create websocket server and stomp connection to message broker
(add after existing code):
```
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
```

2. Subscribe to topic and forward all publications to websocket clients
(below ```// additional code here``` ):
```
//subscribe to topic and send to all websocket clients
stompclient.subscribe(topic, (err, msg) => {
  msg.readString('UTF-8', (err, body) => {
    console.log('sending: %s', body);
    wss.clients.forEach((websocketclient) => { websocketclient.send(body); });
  });
});
```

3. Publish messages from websocket to topic:
```
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
```

4. Ensure cleanup on exit:
```
//cleanup on exit
process.on('exit', function () { //on 'SIGTERM'
  stompclient.disconnect();
});
```

## Rebuild & demonstrate 'blue' application
1. Rebuild 'blue' application from current source code:
```
$ oc start-build clickgame-blue --from-dir=.
```

2. Demonstrate the created application -
all users should be able to jointly create blue circles
by clicking on the canvas.

## Build 'green' application & adjust route
1. Adjust the message to be published (under ```//adjust message here``` ):
```
var o = JSON.parse(msg);
o.color = 'green';
msg = JSON.stringify(o);
```

2. Build 'green' application from current source code:
```
$ oc start-build clickgame-green --from-dir=.
```

3. Switch from 'blue' to 'green':
```
$ oc patch route clickgame -p '{"spec":{"to":{"name":"clickgame-green"}}}'
```

4. Change route weights to 50% blue/50% green:
```
$ oc patch route clickgame -p \
'{"spec":{"to":{"name":"clickgame-blue","weight":50},
"alternateBackends":[{"name":"clickgame-green","weight":50,"kind":"Service"}]}}'
```

5. Continue creating circles, 50% should now be blue and 50% should be green.

## Reset Demo
1. ```git checkout public/index.html server.js```
2. ```oc delete all,templates --all```
