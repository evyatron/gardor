var path        = require('path');
var express     = require('express');
var bodyParser  = require('body-parser');
var fs          = require('fs');


var PORT = process.env.PORT || 3000;
var IP   = process.env.IP   || '0.0.0.0';

var app = express(); 


// Default client routing for all static assets
var routerClient = express.Router();
routerClient.use(express.static(path.resolve(__dirname, 'client')));
app.use('/', routerClient);



// API routing - for editor work
var routerAPI = express.Router();
routerAPI.use(bodyParser.urlencoded({ extended: false }));
routerAPI.use(bodyParser.json());

function getGamePath(gameId) {
  return path.resolve(__dirname, 'client/data/' + gameId + '.json');
}

function apiError(res, err) {
  console.warn('Error in APi', err);
  
  res.json({
    'error': err
  });
}

function apiSaveFile(res, path, content) {
  fs.access(path, fs.W_OK, function onAccess(err) {
    if (err) {
      apiError(res, err);
      return;
    }

    fs.writeFile(path, content, 'utf8', function onFileWrite(err, data) {
      if (err) {
        apiError(res, err);
      } else {
        res.json({
          'success': true
        });
      }
    });
  });
}

function apiPrintJSON(res, path) {
  fs.readFile(path, 'utf8', function onFileRead(err, data) {
    if (err) {
      apiError(res, err);
      return;
    }
    
    res.json(JSON.parse(data));
  });
}

// Get a game
routerAPI.get('/game/:game_id', function onRequestRoot(req, res) {
  apiPrintJSON(res, getGamePath(req.params.game_id));
});

// Update a game
routerAPI.post('/game/:game_id', function onRequestRoot(req, res) {
  var content = req.body;
  
  if (content) {
    try {
      content = JSON.stringify(content, null, 2);
    } catch(ex) {
      console.warn('Got invalid JSON from save request');
      content = null;
    }
  }
    
  if (!content) {
    apiError(res, 'Missing or invalid JSON posted to the request');
    return;
  }
  
  apiSaveFile(res, getGamePath(req.params.game_id), content);
});

app.use('/api', routerAPI);



// Run the server
app.listen(PORT, IP);
console.log('Server running on ' + IP + ':' + PORT + '...');