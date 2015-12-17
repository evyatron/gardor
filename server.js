//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var socketio = require('socket.io');
var express = require('express');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));


io.on('connection', function (socket) {

  socket.on('disconnect', function () {
    
  });

  socket.on('message', function (msg) {
    
  });

  socket.emit('name', '');
});


server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  
});
