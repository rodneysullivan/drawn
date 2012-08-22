$(function () {
  "use strict";

  // for better performance - to avoid searching in DOM
  var content = $('#content');
  var input = $('#input');
  var status = $('#status');
  var dealerName = 'Dealer';
  var dealerColor = '#000000';
  var timerTimeout = 1000;
  
  var drawing = false;
  var word;
  

  // my color assigned by the server
  var myColor = false;
  // my name sent to the server
  var myName = false;

  // Open Socket.IO connection
  var socket = io.connect("http://localhost", {port: 1337});

  socket.on('connect', function () {
    // first we want users to enter their names
    input.removeAttr('disabled');
    status.text('Choose name:');

    socket.on('error', function (error) {
      // just in there were some problems with conenction...
      content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                                  + 'connection or the server is down.</p>' } ));
    });

    // most important part - incoming messages
    socket.on('guess', function (data) {
      input.removeAttr('disabled'); // let the user write another message
      addMessage(data.author, data.guess,
                 data.color, new Date(data.time));
    });

    socket.on('config', function(data) {
      myColor = data.color;
      drawing = data.drawing;
      if (drawing) {
        word = data.word;
        addMessage(dealerName, 'You get to draw \'' + word + '\'', dealerColor, new Date());
      }
      else {
        addMessage(dealerName, 'Guess the word!', dealerColor, new Date());
      }
      status.text(myName + ': ').css('color', myColor);
      input.removeAttr('disabled').focus();
    });

    socket.on('history', function(data) {
      // insert all messages into the chat window
      for (var i=0; i < data.history.length; i++) {
          addMessage(data.history[i].author, data.history[i].guess,
                     data.history[i].color, new Date(data.history[i].time));
      }
    });

    socket.on('drawing', function(data) {
      clickX = data.x;
      clickY = data.y;
      clickDrag = data.drag;
      redraw();
    });

    socket.on('guessed', function(data) {
      drawing = false;
      addMessage(dealerName,
                 '' + data.user + ' guessed the word - ' + data.word + '!',
                 dealerColor,
                 new Date());
    });
    
  });


  // Send mesage when user presses Enter key
  input.keydown(function(e) {
    if (e.keyCode === 13) {
      var text = $(this).val();
      if (!text) {
        return;
      }

      // The first message typed by the user is their name
      if (myName === false) {
        socket.emit( 'newuser', { username: text } );
        myName = text;
      }
      else {
        socket.emit( 'guess', { guess: text } );
      }

      $(this).val('');
        input.attr('disabled', 'disabled');
    }
  });

  /**
   * This method is optional. If the server wasn't able to respond to the
   * in 3 seconds then show some error message to notify the user that
   * something is wrong.
   */
  setInterval(function() {
//    if (socket.readyState !== 1) {
//      status.text('Error');
//        input.attr('disabled', 'disabled').val('Unable to comminucate '
//                                             + 'with the Socket.IO server.');
//    }
  }, 3000);

  // Add message to the chat window
  function addMessage(author, message, color, dt) {
    content.append('<p><span style="color:' + color + '">' + author + '</span> @ ' +
         + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
         + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
         + ': ' + message + '</p>');
  }
  
  var canvasWidth = 490;
  var canvasHeight = 220;
  
  var clickX = new Array();
  var clickY = new Array();
  var clickDrag = new Array();
  var paint;
  var canvas;
  var context;
  var timing = false;

  function prepareCanvas() {
    var canvasDiv = document.getElementById('canvasDiv');
    canvas = document.createElement('canvas');
    canvas.setAttribute('width', canvasWidth);
    canvas.setAttribute('height', canvasHeight);
    canvas.setAttribute('id', 'canvas');
    canvasDiv.appendChild(canvas);
    if (typeof G_vmlCanvasManager != 'undefined') {
      canvas_simple = G_vmlCanvasManager.initElement(canvas);
    }
    context = canvas.getContext('2d');
  
    $('#canvas').mousedown(function(e) {
      if (!drawing) return;
    
      var mouseX = e.pageX - this.offsetLeft;
      var mouseY = e.pageY - this.offsetTop;
      
      paint = true;
      addClick(mouseX, mouseY, false);
      redraw();
    });
    
    $('#canvas').mousemove(function(e) {
      if (!drawing) return;
    
      if(paint) {
        addClick(e.pageX - this.offsetLeft, e.pageY - this.offsetTop, true);
        redraw();
      }
    });
    
    $('#canvas').mouseup(function(e) {
      if (!drawing) return;
    
      paint = false;
      redraw();
    });
    
    $('#canvas').mouseleave(function(e) {
      if (!drawing) return;
    
      paint = false;
    });
  }

  function addClick(x, y, dragging) {
    clickX.push(x);
    clickY.push(y);
    clickDrag.push(dragging);
  }
  
  function clearCanvas() {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    canvas.width = canvas.width;
  }
  
  function redraw() {
    clearCanvas();
    
    var radius = 3;
    context.strokeStyle = '#000000';
    context.lineJoin = 'round';
    context.lineWidth = radius;
    
    for (var i=0; i < clickX.length; i++) {
      context.beginPath();
      if (clickDrag[i] && i) {
        context.moveTo(clickX[i-1], clickY[i-1]);
      } else {
        context.moveTo(clickX[i]-1, clickY[i]);
      }
      context.lineTo(clickX[i], clickY[i]);
      context.closePath();
      context.stroke();
    }
    
    if (drawing && !timing) {
      timing = true;
      setTimeout(submitDrawing, timerTimeout);
    }
  }
  
  prepareCanvas();
  
  function submitDrawing() {
    socket.emit('drawing', { x:clickX, y:clickY, drag:clickDrag });
    timing = false;
  }
  
});
