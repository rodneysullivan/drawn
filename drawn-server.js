"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-drawn';

/**
 * Global variables
 */
// Port where we'll run the Sicket.IO server
var SocketIOServerPort = 1337;
// latest 100 messages
var history = [ ];
// list of currently connected clients (users)
var clients = [ ];
// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

// HTTP server
var nodeStatic = require('node-static');
var clientFiles = new nodeStatic.Server('./static');
var server = require('http').createServer(function(request, response) {
  // Serve static files
  request.addListener('end', function() { clientFiles.serve(request, response);});
});

// Socket.IO server
var io = require('socket.io').listen(server);

server.listen(SocketIOServerPort, function() {
  console.log((new Date()) + " Server is listening on port " + SocketIOServerPort);
});

io.sockets.on('connection', function(socket) {
  // we need to know client index to remove them on 'close' event
  var index = clients.push(socket) - 1;
  var userName = false;
  var userColor = false;

  console.log((new Date()) + ' Connection accepted.');

  // send back chat history
  if (history.length > 0) {
    socket.emit('history', { history: history });
  }

  socket.on('newuser', function(data) {
    userName = htmlEscape(data.username);
    // get random color and send it back to the user
    userColor = colors.shift();
    socket.emit('color', { color: userColor });
    console.log((new Date()) + ' User is known as: ' + userName
                 + ' with ' + userColor + ' color.');
  });

  // user sent a chat message
  socket.on('chat', function(data) {
    console.log((new Date()) + ' Received Message from '
                + userName + ': ' + data.text);
                
    var obj = {
      time: (new Date()).getTime(),
      text: htmlEscape(data.text),
      author: userName,
      color: userColor
    };

    // maintain the history of all sent messages
    history.push(obj);
    history = history.slice(-100);

    io.sockets.emit('chat', obj);
  });

  socket.on('disconnect', function(socket) {
    if (userName !== false && userColor !== false) {
      console.log((new Date()) + " Peer "
          + userName + " disconnected.");
      // remove user from the list of connected clients
      clients.splice(index, 1);
      // push back user's color to be reused by another user
      colors.push(userColor);
    }
  });

});

// For escaping input strings
function htmlEscape(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

