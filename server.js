var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var express = require('express');
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

var port = process.env.PORT || 3000;
var ip = process.env.IP || '0.0.0.0';

router.use(express.static(path.resolve(__dirname, 'client')));

function onNewConnection(socket) {
  console.log('New connection', socket.id);
}

io.on('connection', onNewConnection);


server.listen(port, ip, function onServerRunning(){
  console.info('Server running on ' + ip + ':' + port + '...');
});
