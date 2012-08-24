"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-drawn';

/**
 * Global variables
 */
// Port where we'll run the Socket.IO server
var SocketIOServerPort = 1337;
// latest 100 messages
//var history = [ ];
// current drawing
//var drawingData;
// list of currently connected clients (users)
var clients = [ ];
// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );
// Array with some words
var words = [ 'dj', 'cat', 'house', 'horse', 'surfing', 'apple', 'pencil' ];
words.sort(function(a,b) { return Math.random() > 0.5; } );

// true if we have a drawer
var drawerFound = false;
// The word the user gets to draw
var userWord;
// The word that guesses are matched against
var serverWord;
// Index of drawer
var drawerIndex;
// How many turns we've had
var turnIndex = 0;

var redis = require('redis').createClient();
redis.flushall();

// HTTP server
var nodeStatic = require('node-static');
var clientFiles = new nodeStatic.Server('./static');
var server = require('http').createServer(function(request, response) {
  // Serve static files
  request.addListener('end', function() { clientFiles.serve(request, response);});
});

// Socket.IO server
var io = require('socket.io').listen(server);
io.set('log level', 1);

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
  emitHistory();

  socket.on('newuser', function(data) {
    userName = htmlEscape(data.username);
    // get random color and send it back to the user
    userColor = colors.shift();
    if (userDrawing) {
      drawerIndex = index;
      getWord();
    }
    socket.emit('config', { color: userColor, drawing: userDrawing, word: userWord });
    console.log((new Date()) + ' User is known as: ' + userName
                 + ' with ' + userColor + ' color.');
  });

  socket.on('drawing', function(data) {
    socket.broadcast.emit('drawing', data);
    setDrawingData(data);
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
    addHistory(JSON.stringify(obj));

    io.sockets.emit('guess', obj);
    
    // Check to see if the guess is correct
    if (!(drawerIndex==index) && correctGuess(data.guess)) {
      drawerIndex = index;
      var guessedWord = userWord;
      newTurn();
      socket.emit('guessed', { user: userName, word: guessedWord, yourTurn: true, newWord:userWord } );
      socket.broadcast.emit('guessed', { user: userName, word: guessedWord, yourTurn: false, newWord:userWord } );
    }
  });

  socket.on('disconnect', function(socket) {
    // remove user from the list of connected clients
    clients.splice(index, 1);
    console.log("clients.length="+clients.length);
    if (clients.length == 0) {
      userDrawing = false;
      clearHistory();
      clearDrawingData();
    }

    if (userName !== false && userColor !== false) {
      console.log((new Date()) + " Peer "
          + userName + " disconnected.");
      // push back user's color to be reused by another user
      colors.push(userColor);
    } else {
      console.log((new Date()) + " Unnamed peer disconnected.");
    }
  });

  function getWord() {
    // TODO pick a random word from a file.
    // TODO have the word include a list of valid guesses 
    //      (e.g. "DJ" would be satisfied by "D J")
    //      Note that the matching is currently case insensitive
    userWord = words[turnIndex];
    serverWord = userWord.toLowerCase();
  }

  function newTurn() {
    clearDrawingData();
    turnIndex++;
    if (turnIndex == words.length) {
      words.sort(function(a,b) { return Math.random() > 0.5; } );
      turnIndex = 0;
    }
    getWord();
  }

  function correctGuess(guess) {
    console.log("serverWord="+serverWord+", guess="+guess);
    return serverWord == guess.toLowerCase();
  }

  function emitHistory() {
    redis.lrange('history', 0, -1, function(error, history) {
      if (error) {
        return console.log('get history error: ' + error);
      }
      
      var parsedHistory = [];
      history.forEach(function(historyEntry) {
        parsedHistory.push(JSON.parse(historyEntry));
      })
      
      redis.get('drawingData', function(error, drawingData) {
        if (error) {
          return console.log('get drawingData error: ' + error);
        }
        
        var parsedDrawingData;
        if (drawingData) {
          parsedDrawingData = JSON.parse(drawingData);
        }
        if (parsedHistory.length > 0 || parsedDrawingData) {
          socket.emit('history', { history: parsedHistory, drawing: parsedDrawingData });
        }
      });
      
    });
  }


});

// For escaping input strings
function htmlEscape(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


function addHistory(history) {
  redis.rpush('history', history);
  //todo trim
}

function clearHistory() {
  redis.del('history');
}

function setDrawingData(drawingData) {
  redis.set('drawingData', JSON.stringify(drawingData));

}

function clearDrawingData() {
  redis.del('drawingData');
}



