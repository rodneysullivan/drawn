"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-drawn';

/**
 * Global variables
 */
// Port where we'll run the Socket.IO server
var SocketIOServerPort = 1337;
// latest 100 messages
var history = [ ];
// list of currently connected clients (users)
var clients = [ ];
// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

// The word the user gets to draw
var userWord;
// The word that guesses are matched against
var serverWord;

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
  var userDrawing = (index == 0); // The first user gets to draw

  console.log((new Date()) + ' Connection accepted: ' + userDrawing);

  // send back chat history
  if (history.length > 0) {
    socket.emit('history', { history: history });
  }

  socket.on('newuser', function(data) {
    userName = htmlEscape(data.username);
    // get random color and send it back to the user
    userColor = colors.shift();
    if (userDrawing) {
      getWord();
    }
    socket.emit('config', { color: userColor, drawing: userDrawing, word: userWord });
    console.log((new Date()) + ' User is known as: ' + userName
                 + ' with ' + userColor + ' color.');
  });

  socket.on('drawing', function(data) {
    socket.broadcast.emit('drawing', data);
  });

  // user sent a guess
  socket.on('guess', function(data) {
    console.log((new Date()) + ' Received Message from '
                + userName + ': ' + data.guess);
                
    var obj = {
      time: (new Date()).getTime(),
      guess: htmlEscape(data.guess),
      author: userName,
      color: userColor
    };

    // maintain the history of all sent messages
    history.push(obj);
    history = history.slice(-100);

    io.sockets.emit('guess', obj);
    
    // Check to see if the guess is correct
    if (!userDrawing && correctGuess(data.guess)) {
      io.sockets.emit('guessed', { user: userName, word: userWord } );
    }
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

  function getWord() {
    // TODO pick a random word from a file.
    // TODO have the word include a list of valid guesses 
    //      (e.g. "DJ" would be satisfied by "D J")
    //      Note that the matching is currently case insensitive
    userWord = "DJ";
    serverWord = userWord.toLowerCase();
  }

  function correctGuess(guess) {
    console.log("serverWord="+serverWord+", guess="+guess);
    return serverWord == guess.toLowerCase();
  }

});

// For escaping input strings
function htmlEscape(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

