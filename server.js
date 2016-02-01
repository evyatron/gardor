var path        = require('path');
var express     = require('express');
var bodyParser  = require('body-parser');
var fs          = require('fs');
var app         = express(); 

// Default client routing for all static assets
var routerClient = express.Router();
routerClient.use(express.static(path.resolve(__dirname, 'client')));
app.use('/', routerClient);

// API routing - for editor work
var routerAPI = express.Router();
routerAPI.get('/game/:game_id', getGame);                 // Get game  - api/game/[GAME_ID]
routerAPI.post('/game/:game_id', updateGame);             // Save game - api/game/[GAME_ID]
routerAPI.get('/game/:game_id/map/:map_id', getMap);      // Get map   - api/game/[GAME_ID]/map/[MAP_ID]
routerAPI.post('/game/:game_id/map/:map_id', updateMap);  // Save map  - api/game/[GAME_ID]/map/[MAP_ID]
routerAPI.get('/game/:game_id/fs', getGameFilesystem);    // Get files - api/game/[GAME_ID]/fs
routerAPI.use(bodyParser.urlencoded({ extended: false }));
routerAPI.use(bodyParser.json());
app.use('/api', routerAPI);

/* End-points start */
function getGame(req, res) {
  console.log('[API][Game|' + req.params.game_id + '] Get');
  apiPrintJSON(res, getGamePath(req.params.game_id));
}

function updateGame(req, res) {
  console.log('[API][Game|' + req.params.game_id + '] Save');
  
  var content = apiGetJSONToSave(req, res);
  if (content) {
    apiSaveFile(res, getGamePath(req.params.game_id), content);
  }
}

function getMap(req, res) {
  console.log('[API][Map|' + req.params.map_id + '] Get');
  apiPrintJSON(res, getMapPath(req.params.game_id, req.params.map_id));
}

function updateMap(req, res) {
  console.log('[API][Map|' + req.params.map_id + '] Save');
  
  var content = apiGetJSONToSave(req, res);
  if (content) {
    apiSaveFile(res, getMapPath(req.params.game_id, req.params.map_id), content);
  }
}

function getGameFilesystem(req, res) {
  var path = getGameBasePath(req.params.game_id);
  
  if (req.query.dir) {
    path += '/' + req.query.dir.replace(/\.\.\//g, '');
  }
  
  fs.readdir(path, function onOpenGameDir(err, files) {
    if (err) {
      apiError(res, err);
    } else {
      res.json(files);
    }
  });
}
/* End-points End */

function getGameBasePath(gameId) {
  return path.resolve(__dirname, 'client/' + cleanupPath(gameId));
}

function getGamePath(gameId) {
  return getGameBasePath(gameId) + '/game.json';
}

function getMapPath(gameId, mapId) {
  return getGameBasePath(gameId) + '/maps/' + cleanupPath(mapId) + '.json';
}

function cleanupPath(id) {
  return id.toLowerCase().replace(/\s/g, '-');
}

function apiError(res, err) {
  console.warn('Error in APi', err);
  
  res.status(500);
  res.json({
    'error': err
  });
}

function apiSaveFile(res, path, content) {
  fs.access(path, fs.W_OK, function onAccess(err) {
    if (err) {
      apiError(res, err);
    } else {
      fs.writeFile(path, content, 'utf8', function onFileWrite(err, data) {
        if (err) {
          apiError(res, err);
        } else {
          res.json({
            'success': true
          });
        }
      });
    }
  });
}

function apiPrintJSON(res, path) {
  fs.readFile(path, 'utf8', function onFileRead(err, data) {
    if (err) {
      apiError(res, err);
    } else {
      res.json(JSON.parse(data));
    }
  });
}

function apiGetJSONToSave(request, response) {
  var content = request.body;
  
  if (content) {
    try {
      content = JSON.stringify(content, null, 2);
    } catch(ex) {
      console.warn('Got invalid JSON from save request');
      content = null;
    }
  }
    
  if (!content) {
    apiError(response, 'Missing or invalid JSON posted to the request');
    return;
  }
  
  return content;
}

(function addTimestampsToLogs() {
  var log = console.log;
  var info = console.info;
  var warn = console.warn;
  
  console.log = function(){ log.apply(this, [getDate()].concat([].slice.call(arguments))); };
  console.info = function(){ info.apply(this, [getDate()].concat([].slice.call(arguments))); };
  console.warn = function(){ warn.apply(this, [getDate()].concat([].slice.call(arguments))); };
  
  function getDate() {
    var date = new Date();
    var h = date.getHours();
    var m = date.getMinutes();
    var s = date.getSeconds();
    var ms = date.getMilliseconds();
    
    (h < 10) && (h = '0' + h);
    (m < 10) && (m = '0' + m);
    (s < 10) && (s = '0' + s);
    (ms < 10) && (ms = '00' + s);
    (ms < 100) && (ms = '0' + s);
    
    return h + ':' + m + ':' + s + '.' + ms;
  }
}());


// Run the server
var PORT = process.env.PORT || 3000;
var IP   = process.env.IP   || '0.0.0.0';
app.listen(PORT, IP);
console.log('Server running on ' + IP + ':' + PORT + '...');