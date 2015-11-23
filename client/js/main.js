var game;
var DEBUG = /DEBUG/.test(window.location.search);
var DEBUG_NAVMESH = /NAVMESH/.test(window.location.search);
var EDITOR = /EDITOR/.test(window.location.search);

function init() {
  game = new Game({
    'el': document.getElementById('game'),
    'config': '/data/game.json'
  });
  
  if (EDITOR) {
    utils.loadScript('/js/editor.js');
  }
}

var EventDispatcher = (function EventDispatcher() {
  function EventDispatcher() {
    this._listeners = {};
  }

  EventDispatcher.prototype.dispatch = function dispatch(eventName, data) {
    if (!this._listeners) {
      this._listeners = {};
    }

    var listeners = this._listeners[eventName] || [];
    for (var i = 0, len = listeners.length; i < len; i++) {
      listeners[i].call(this, data);
    }
  };

  EventDispatcher.prototype.on = function on(eventName, callback) {
    if (!this._listeners) {
      this._listeners = {};
    }

    if (!this._listeners[eventName]) {
      this._listeners[eventName] = [];
    }

    this._listeners[eventName].push(callback);
  };

  EventDispatcher.prototype.off = function off(eventName, callback) {
    if (!this._listeners) {
      this._listeners = {};
    }

    var listeners = this._listeners[eventName] || [];
    for (var i = 0, len = listeners.length; i < len; i++) {
      if (listeners[i] === callback) {
        listeners.splice(i, 1);
        break;
      }
    }
  };

  EventDispatcher.prototype.once = function once(eventName, callback) {
    if (!this._listeners) {
      this._listeners = {};
    }
    
    this.on(eventName, function callbackOnce() {
      this.off(eventName, callbackOnce);
      callback.apply(this, arguments);
    }.bind(this));
  };

  return EventDispatcher;
}());

var Game = (function Game() {
  function Game(options) {
    this.el = null;
    
    this.lastUpdate = 0;
    this.dt = 0;
    this.isReady = false;
    this.layers = {};
    
    this.width = 0;
    this.height = 0;
    this.mapWidth = 0;
    this.mapHeight = 0;
    this.bleed = {
      'x': 0,
      'y': 0
    };
    this.offset = {
      'x': 0,
      'y': 0
    };
    
    this.currentMap = null;
    
    this.tiles = {};
    this.modules = {};
    this.maps = {};
    this.config = null;
    
    this.camera = null;
    this.playerController = null;
    this.navMesh = null;
    
    this.clickTexture = null;
    this.timeShownClickTexture = 0;
    
    this.actorsUnderPointer = {};

    this.stats = {
      'update': {},
      'draw': {},
      'textures': 0
    };
    this.runningBenchmarks = {};
    
    this.GOTO_MAP_RESULT = {
      SUCCESS: 0,
      NOT_LOADED: 1,
      LOADING: 2,
      ERROR: 3
    };
    
    EventDispatcher.apply(this);

    this.init(options);
  }
  
  Game.prototype = Object.create(EventDispatcher.prototype);
  Game.prototype.constructor = Game;
  
  Game.prototype.init = function init(options) {
    !options && (options = {});
    
    this.el = options.el || document.body;
    
    this.playerController = new PlayerController({
      'game': this
    });
    
    this.camera = new Camera({
      'game': this
    });
    
    this.navMesh = new NavMesh({
      'game': this
    });
    
    InputManager.bindAction('interact', InputManager.KEYS.LEFT_MOUSE_BUTTON);
    
    InputManager.on('pressed', 'interact', this.onPointerClick.bind(this));
    
    
    window.addEventListener('resize', this.onResize.bind(this));
    this.onResize();
    
    if (options.config) {
      this.loadConfig(options.config);
    }
  };
  
  Game.prototype.createGame = function createGame() {
    this.camera.updateConfigFromGame();
    
    this.layers.background = new TilesetLayer({
      'id': 'background',
      'game': this
    });
    this.layers.actors = new Layer({
      'id': 'actors',
      'game': this
    });
    this.layers.hud = new HUDLayer({
      'id': 'hud',
      'game': this
    });
    
    this.clickTexture = this.config.clickTexture;
    
    var tiles = this.config.tiles;
    for (var i = 0, len = tiles.length; i < len; i++) {
      var tile = tiles[i];
      tile.texture = new Texture(tile.texture);
      this.tiles[tile.id] = tile;
    }
    
    var modules = this.config.modules;
    for (var i = 0, len = modules.length; i < len; i++) {
      var module = modules[i];
      this.modules[module.id] = module;
    }
    
    if (this.config.startingMap) {
      this.goToMap(this.config.startingMap);
    }
    
    this.isReady = true;
    this.dispatch('created', this);

    this.lastUpdate = Date.now();
    window.requestAnimationFrame(this.tick.bind(this));
  };
  
  Game.prototype.goToMap = function goToMap(mapId) {
    var map = this.maps[mapId];
    
    if (!map) {
      this.loadMap(mapId, this.goToMap.bind(this, mapId));
      return this.GOTO_MAP_RESULT.NOT_LOADED;
    }
    
    if (map === true) {
      return this.GOTO_MAP_RESULT.LOADING;
    }
    
    this.currentMap = map;
    
    this.mapWidth = map.grid[0].length * this.config.tileSize;
    this.mapHeight = map.grid.length * this.config.tileSize;

    this.onResize();

    for (var id in this.layers) {
      this.layers[id].setMap(map);
    }
    
    var controlledActorId = map.playerActor;
    if (controlledActorId) {
      var actor = this.layers.actors.actorsMap[controlledActorId];
      if (actor) {
        this.playerController.setControlledActor(actor);
        
        if (this.config.followPlayer) {
          this.camera.setActorToFollow(this.playerController.controlledActor);
        }
      }
    }
    
    this.navMesh.update();

    this.onResize();
    
    this.dispatch('mapCreated', this);
    
    console.info('gotomap', map);
  };
  
  Game.prototype.getModuleConfig = function getModuleConfig(moduleId) {
    return this.modules[moduleId];
  };
  
  Game.prototype.tick = function tick() {
    var now = Date.now();
    
    this.dt = (now - this.lastUpdate) / 1000;
    
    this.stats.textures = 0;

    // Update - logic
    this.update(this.dt);
    // Draw - only drawing - no logic should be done here
    this.draw();
    
    this.log('update: ' + this.stats.update.time + 'ms');
    this.log('draw: ' + this.stats.draw.time + 'ms');
    this.log('textures: ' + this.stats.textures);
    
    // Next tick please
    this.lastUpdate = now;
    window.requestAnimationFrame(this.tick.bind(this));
  };
  
  Game.prototype.update = function update(dt) {
    this.runningBenchmarks = {};
    
    this.startBenchmark('global', 'update');
    
    // Update player controller to check for input
    this.playerController.update(dt);

    // Initialise a map of actors under the pointer,
    // to avoid each actor or layer calculating this
    this.actorsUnderPointer = {};
    var actorsUnderPointer = this.getActorsOnTile(this.getPointerTile());
    for (var i = 0, len = actorsUnderPointer.length; i < len; i++) {
      this.actorsUnderPointer[actorsUnderPointer[i].id] = actorsUnderPointer[i];
    } 
    
    // Update all layers
    for (var id in this.layers) {
      this.layers[id].update(dt);
    }
    
    // Update camera (lerping position)
    this.camera.update(dt);
    
    this.stats.update = this.endBenchmark('global', 'update');
  };
  
  Game.prototype.draw = function draw() {
    this.startBenchmark('global', 'draw');
    
    for (var id in this.layers) {
      this.layers[id].draw();
    }
    
    this.stats.draw = this.endBenchmark('global', 'draw');
  };
  
  Game.prototype.onPointerClick = function onPointerClick(e) {
    var clickedTile = this.getPointerTile();
    var actors = this.getActorsOnTile(clickedTile);
    var wasClickHandled = false;
    
    for (var i = 0, len = actors.length; i < len; i++) {
      if (actors[i].onClick(e)) {
        wasClickHandled = true;
      }
    }
    
    if (!wasClickHandled) {
      var isBlocked = this.navMesh.isBlocked(clickedTile);
      if (!isBlocked) {
        this.playerController.moveTo(clickedTile);
        this.layers.hud.onClick(e);
      }
    }
  };
  
  Game.prototype.getActorsOnTile = function getActorsOnTile(tile) {
    var actors = this.layers.actors.actors;
    var actorsOnTile = [];
    
    for (var id in actors) {
      var actorTile = actors[id].tile;
      if (utils.tilesEqual(actorTile, tile)) {
        actorsOnTile.push(actors[id]);
      }
    }
    
    return actorsOnTile;
  };
  
  Game.prototype.getPointerTile = function getPointerTile() {
    return this.getTileFromCoords(this.playerController.pointer);
  };
  
  Game.prototype.getOffsetPosition = function getOffsetPosition(position) {
    return {
      'x': position.x - this.camera.x,
      'y': position.y - this.camera.y
    };
  };
  
  Game.prototype.getTileFromCoords = function getTileFromCoords(position) {
    var size = this.config.tileSize;
    
    return {
      'x': Math.floor(position.x / size),
      'y': Math.floor(position.y / size)
    };
  };
  
  Game.prototype.getCoordsFromTile = function getCoordsFromTile(tile) {
    var size = this.config.tileSize;
    
    return {
      'x': (tile.x * size) + size / 2,
      'y': (tile.y * size) + size / 2
    };
  };

  Game.prototype.distance = function distance(from, to) {
    var distX = to.x - from.x;
    var distY = to.y - from.y;
    
    return Math.sqrt(distX * distX + distY * distY);
  };
  
  Game.prototype.loadMap = function loadMap(mapId, callback) {
    console.log('Get Map:', mapId);
    
    this.request('/data/' + mapId + '.json', function onMapLoaded(mapData) {
      this.maps[mapData.id] = mapData;
      callback && callback(mapData);
    }.bind(this));
    
    this.maps[mapId] = true;
  };
  
  Game.prototype.loadConfig = function loadConfig(config) {
    console.log('Get Config:', config);
    
    this.request(config, this.onLoadConfig.bind(this));
  };
  
  Game.prototype.onLoadConfig = function onLoadConfig(config) {
    console.info('Got Config', config);
    
    this.config = config;
    this.createGame();
  };
  
  Game.prototype.startBenchmark = function startBenchmark(type, id) {
    if (!DEBUG) {
      return {};
    }
    
    var benchmark = {
      'id': id,
      'type': type,
      'timeStart': Date.now()
    };
    
    this.runningBenchmarks[type + '.' + id] = benchmark;
    
    return benchmark;
  };
  
  Game.prototype.endBenchmark = function endBenchmark(type, id) {
    if (!DEBUG) {
      return {};
    }
    
    var benchmark = this.runningBenchmarks[type + '.' + id];
    if (benchmark) {
      benchmark.timeEnd = Date.now();
      benchmark.time = benchmark.timeEnd - benchmark.timeStart;

      delete this.runningBenchmarks[type + '.' + id];
    }
    
    return benchmark;
  };
  
  Game.prototype.log = function log(message) {
    if (!DEBUG) {
      return;
    }
    
    this.layers.hud.writeLine(message);
  };
  
  Game.prototype.onResize = function onResize() {
    var bounds = this.el.getBoundingClientRect();
    var elParent = this.el.parentNode;
    var padding = this.currentMap && this.currentMap.padding || 0;
    
    if (this.currentMap && this.currentMap.width && this.currentMap.height) {
      this.width = Math.min(this.currentMap.width, elParent.offsetWidth - padding);
      this.height = Math.min(this.currentMap.height, elParent.offsetHeight - padding);
    } else {
      this.width = elParent.offsetWidth - padding;
      this.height = elParent.offsetHeight - padding;
    }
    
    this.width = Math.min(this.width, this.mapWidth);
    this.height = Math.min(this.height, this.mapHeight);
    
    if (this.width % 2 === 1) {
      this.width--;
    }
    if (this.height % 2 === 1) {
      this.height--;
    }
    
    this.el.style.width = this.width + 'px';
    this.el.style.height = this.height + 'px';
    
    this.offset = {
      'x': bounds.left,
      'y': bounds.top
    };
    
    for (var id in this.layers) {
      this.layers[id].onResize();
    }
    
    this.bleed.x = this.mapWidth - this.width;
    this.bleed.y = this.mapHeight - this.height;
    
    if (this.bleed.x < 0) {
      this.bleed.x = this.bleed.x / 2;
    }
    if (this.bleed.y < 0) {
      this.bleed.y = this.bleed.y / 2;
    }
    
    this.camera.onResize();
  };
  
  Game.prototype.request = function request(url, callback) {
    console.log('Request:', url);
    
    var httpRequest = new XMLHttpRequest();
    
    httpRequest.open('GET', url, true);
    
    httpRequest.responseType = 'json';
    
    httpRequest.onload = function onRequestDone(e) {
      callback(e.target.response);
    };
    
    httpRequest.send();
  };
  
  return Game;
}());

var Layer = (function Layer() {
  function Layer(options) {
    this.id = '';
    this.game;
    this.canvas;
    this.context;
    
    this.actors = [];
    this.actorsMap = {};
    
    this.isDirty = false;
    
    this.init(options);
  }
  
  Layer.prototype.init = function init(options) {
    this.id = options.id;
    this.game = options.game;
    
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.game.el.appendChild(this.canvas);
    
    this.onResize();
  };
  
  Layer.prototype.setMap = function setMap(map) {
    console.info('[Layer] setMap', this.id, map);
    
    this.actors = [];
    this.actorsMap = {};
    
    for (var i = 0, len = map.actors.length; i < len; i++) {
      var actorData = map.actors[i];
      actorData.layer = this;
      
      var actor = new Actor(actorData);
      this.actors.push(actor);
      this.actorsMap[actor.id] = actor;
    }
    
    this.actors.sort(function actorSorter(a, b) {
      return a.tile.y > b.tile.y? 1 :
             a.tile.y < b.tile.y? -1 :
             a.tile.x > b.tile.x? 1 :
             a.tile.x < b.tile.x? -1 :
             0;
    });
    
    return true;
  };
  
  Layer.prototype.update = function update(dt) {
    var actors = this.actors;
    var didUpdate = false;
    
    for (var i = 0, len = actors.length; i < len; i++) {
      if (actors[i].update(dt)) {
        didUpdate = true;
      }
    }
    
    this.isDirty = didUpdate;

    return true;
  };
  
  Layer.prototype.draw = function draw() {
    if (!this.isDirty) {
      return false;
    }
    
    var actors = this.actors;
    var game = this.game;
    
    this.context.clearRect(0, 0, game.width, game.height);
    
    for (var i = 0, len = actors.length; i < len; i++) {
      actors[i].draw(this);
    }
    
    return true;
  };
  
  Layer.prototype.onResize = function onResize() {
    this.canvas.width = this.game.width;
    this.canvas.height = this.game.height;
    this.isDirty = true;
    
    return true;
  };
  
  return Layer;
}());

var TilesetLayer = (function TilesetLayer() {
  function TilesetLayer(options) {
    this.grid = [];
    
    Layer.call(this, options);
  }
  
  TilesetLayer.prototype = Object.create(Layer.prototype);
  TilesetLayer.prototype.constructor = TilesetLayer;
  
  TilesetLayer.prototype.setMap = function setMap(map) {
    console.log('Set Tiles: ', map);
    
    this.grid = map.grid;
  };
  
  TilesetLayer.prototype.update = function update(dt) {
    this.game.startBenchmark('update', 'grid');
    
    this.isDirty = true;
    
    this.game.endBenchmark('update', 'grid');
  };
  
  TilesetLayer.prototype.draw = function draw() {
    if (!this.isDirty) {
      //return false;
    }
    
    this.game.startBenchmark('draw', 'grid');
    
    var game = this.game;
    var camera = game.camera;
    var context = this.context;
    var tilesMap = this.game.tiles;
    var size = this.game.config.tileSize;
    var rows = this.grid;
    
    if (rows.length === 0) {
      return;
    }
    
    var numberOfRows = rows.length - Math.floor((game.bleed.y - camera.y) / size);
    var numberOfCols = rows[0].length - Math.floor((game.bleed.x - camera.x) / size);
    var startRow = Math.floor(camera.y / size);
    var startCol = Math.floor(camera.x / size);
    var tilesDrawn = 0;
    var cell, tile, i, j, columns, x, y;
    
    context.clearRect(0, 0, game.width, game.height);

    for (i = startRow; i < numberOfRows; i++) {
      columns = rows[i];
      
      if (!columns) {
        continue;
      }
      
      for (j = startCol; j < numberOfCols; j++) {
        cell = columns[j];
        tile = tilesMap[cell];
        
        if (tile) {
          x = j * size - camera.x;
          y = i * size - camera.y;
          
          tile.texture.draw(context, x, y);
          
          tilesDrawn++;
          
          // Show tile bounds and indexes
          if (DEBUG) {
            var thisTile = {
              'x': j,
              'y': i
            };
            
            if (DEBUG_NAVMESH) {
              if (game.navMesh.isBlocked(thisTile)) {
                context.fillStyle = 'rgba(255, 0, 0, .5)';
              } else {
                context.fillStyle = 'rgba(0, 255, 0, .5)';
              }
              context.fillRect(x + 3, y + 3, size - 6, size - 6);
            }
            
            var pointerTile = game.getPointerTile();
            if (utils.tilesEqual(thisTile, pointerTile)) {
              context.fillStyle = 'rgba(255, 255, 255, 1)';
              context.beginPath();
              context.arc(x + size / 2, y + size / 2, 6, 0, Math.PI * 2);
              context.fill();
            }
            
            context.strokeStyle = 'rgba(255, 0, 0, .2)';
            context.strokeRect(x, y, size, size);
            
            context.fillStyle = 'rgba(0, 0, 0, 1)';
            context.fillText(j + ',' + i, x + 4, y + 12);
          }
        }
      }
    }
    
    game.log('tiles: ' + tilesDrawn);
    
    this.isDirty = false;
    
    game.endBenchmark('draw', 'grid');
    
    return true;
  };

  return TilesetLayer;
}());

var HUDLayer = (function HUDLayer() {
  function HUDLayer(options) {
    this.tooltip = {
      'actorId': '',
      'x': 0,
      'y': 0,
      'width': 0,
      'height': 0,
      'text': '',
      'padding': [10, 5],
      'isVisible': false
    };
    
    this.clickTexture = null;
    this.clickPosition = {
      'x': 0,
      'y': 0
    };
    this.timeShownClickTexture = 0;
    this.timeToShowClickTexture = 0;
    
    this.debugLines = [];
    
    Layer.call(this, options);
  }
  
  HUDLayer.prototype = Object.create(Layer.prototype);
  HUDLayer.prototype.constructor = HUDLayer;
  
  HUDLayer.prototype.setMap = function setMap(map) {
    var clickTexture = this.game.config.clickTexture;
    
    if (clickTexture) {
      this.clickTexture = new Texture(clickTexture);
      this.timeToShowClickTexture = clickTexture.timeToShow;
      this.timeShownClickTexture = this.timeToShowClickTexture;
    }
  };
  
  HUDLayer.prototype.onClick = function onClick(map) {
    this.timeShownClickTexture = 0;
    var pointer = this.game.playerController.pointer;
    this.clickPosition.x = pointer.x;
    this.clickPosition.y = pointer.y;
  };
      
  HUDLayer.prototype.update = function update(dt) {
    var game = this.game;
    
    game.startBenchmark('update', 'hud');
    
    if (this.timeShownClickTexture < this.timeToShowClickTexture) {
      this.timeShownClickTexture += dt;
    }

    var actorUnderPointer = null;
    for (var id in game.actorsUnderPointer) {
      if (game.actorsUnderPointer[id].tooltip) {
        actorUnderPointer = game.actorsUnderPointer[id];
        break;
      }
    }
    
    var tooltip = this.tooltip;
    if (!actorUnderPointer) {
      tooltip.actorId = '';
      tooltip.isVisible = false;
    } else {
      if (tooltip.actorId !== actorUnderPointer.id) {
        tooltip.actorId = actorUnderPointer.id;
        tooltip.text = actorUnderPointer.tooltip;
        tooltip.isVisible = true;
        tooltip.height = 13;
      }
      
      var offsetPosition = this.game.getOffsetPosition(actorUnderPointer.position);
      tooltip.x = offsetPosition.x;
      tooltip.y = offsetPosition.y + actorUnderPointer.texture.height / 2;
    }
    
    game.endBenchmark('update', 'hud');
    
    return true;
  };
  
  HUDLayer.prototype.writeLine = function writeLine(text) {
    this.debugLines.push(text);
  };
  
  HUDLayer.prototype.draw = function draw() {
    var context = this.context;
    var game = this.game;
    
    game.startBenchmark('draw', 'hud');
    
    context.clearRect(0, 0, game.width, game.height);
    
    // Click Indiactor
    if (this.timeShownClickTexture < this.timeToShowClickTexture) {
      var position = this.game.getOffsetPosition(this.clickPosition);
      this.clickTexture.draw(context, position.x, position.y);
    }
    
    // Tooltip
    var tooltip = this.tooltip;
    if (tooltip.isVisible) {
      tooltip.width = this.context.measureText(tooltip.text).width;
      
      context.textAlign = 'center';
      context.fillStyle = 'rgba(0, 0, 0, .75)';
      context.strokeStyle = 'rgba(0, 0, 0, 1)';
      
      context.fillRect(tooltip.x - tooltip.padding[0] - tooltip.width / 2,
                       tooltip.y - tooltip.padding[1],
                       tooltip.width + tooltip.padding[0] * 2,
                       tooltip.height + tooltip.padding[1] * 2);
                       
      context.strokeRect(tooltip.x - tooltip.padding[0] - tooltip.width / 2,
                       tooltip.y - tooltip.padding[1],
                       tooltip.width + tooltip.padding[0] * 2,
                       tooltip.height + tooltip.padding[1] * 2);

      context.fillStyle = 'rgba(255, 255, 255, 1)';
      context.fillText(tooltip.text, tooltip.x, tooltip.y);
    }
    
    game.endBenchmark('draw', 'hud');

    if (DEBUG) {
      context.fillStyle = 'rgba(255, 255, 255, 1)';
      context.textAlign = 'left';
      this.textOffset = 0;
      for (var i = 0, len = this.debugLines.length; i < len; i++) {
        this.context.fillText(this.debugLines[i], 5, 5 + this.textOffset);
        this.textOffset += 10;
      }
      this.debugLines = [];
    }
    
    return true;
  };

  HUDLayer.prototype.onResize = function onResize() {
    Layer.prototype.onResize.apply(this, arguments);
    
    var context = this.context;
    context.textBaseline = 'top';
    context.textAlign = 'center';
    context.font = 'normal 8pt monospace';
    context.shadowColor = 'rgba(0, 0, 0, 1)';
    context.shadowBlur = 1;
  };
  return HUDLayer;
}());

var utils = {
  'clamp': function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },
  
  'tilesEqual': function tilesEqual(tileA, tileB) {
    return tileA.x === tileB.x && tileA.y === tileB.y;
  },
  
  'getTileOffsetDirection': function getTileOffsetDirection(from, to) {
    return {
      'x': from.x < to.x? 1 : from.x > to.x? -1 : 0,
      'y': from.y < to.y? 1 : from.y > to.y? -1 : 0
    };
  },
  
  'loadScript': function loadScript(src) {
    var el = document.createElement('script');
    el.src = src;
    document.body.appendChild(el);
  }
};

var EasyStar=EasyStar||{};"function"==typeof define&&define.amd&&define("easystar",[],function(){return EasyStar}),"undefined"!=typeof module&&module.exports&&(module.exports=EasyStar),EasyStar.Node=function(t,n,e,i,s){this.parent=t,this.x=n,this.y=e,this.costSoFar=i,this.simpleDistanceToTarget=s,this.bestGuessDistance=function(){return this.costSoFar+this.simpleDistanceToTarget}},EasyStar.Node.OPEN_LIST=0,EasyStar.Node.CLOSED_LIST=1,EasyStar.PriorityQueue=function(t,n){this.length=0;var e=[],i=!1;if(n==EasyStar.PriorityQueue.MAX_HEAP)i=!0;else{if(n!=EasyStar.PriorityQueue.MIN_HEAP)throw n+" not supported.";i=!1}this.insert=function(n){if(!n.hasOwnProperty(t))throw"Cannot insert "+n+" because it does not have a property by the name of "+t+".";e.push(n),this.length++,s(this.length-1)},this.getHighestPriorityElement=function(){return e[0]},this.shiftHighestPriorityElement=function(){if(0===this.length)throw"There are no more elements in your priority queue.";if(1===this.length){var t=e[0];return e=[],this.length=0,t}var n=e[0],i=e.pop();return this.length--,e[0]=i,o(0),n};var s=function(t){if(0!==t){var n=u(t);a(t,n)&&(r(t,n),s(n))}},o=function(t){var n=h(t),e=c(t);if(a(n,t))r(t,n),o(n);else if(a(e,t))r(t,e),o(e);else{if(0==t)return;o(0)}},r=function(t,n){var i=e[t];e[t]=e[n],e[n]=i},a=function(n,s){if(void 0===e[s]||void 0===e[n])return!1;var o,r;return"function"==typeof e[n][t]?(o=e[n][t](),r=e[s][t]()):(o=e[n][t],r=e[s][t]),i?o>r?!0:!1:r>o?!0:!1},u=function(t){return Math.floor((t-1)/2)},h=function(t){return 2*t+1},c=function(t){return 2*t+2}},EasyStar.PriorityQueue.MAX_HEAP=0,EasyStar.PriorityQueue.MIN_HEAP=1,EasyStar.instance=function(){this.isDoneCalculating=!0,this.pointsToAvoid={},this.startX,this.callback,this.startY,this.endX,this.endY,this.nodeHash={},this.openList},EasyStar.js=function(){var t,n,e,i=1,s=1.4,o=!1,r={},a={},u={},h=!0,c=[],l=Number.MAX_VALUE,f=!1;this.setAcceptableTiles=function(t){t instanceof Array?e=t:!isNaN(parseFloat(t))&&isFinite(t)&&(e=[t])},this.enableSync=function(){o=!0},this.disableSync=function(){o=!1},this.enableDiagonals=function(){f=!0},this.disableDiagonals=function(){f=!1},this.setGrid=function(n){t=n;for(var e=0;e<t.length;e++)for(var i=0;i<t[0].length;i++)a[t[e][i]]||(a[t[e][i]]=1)},this.setTileCost=function(t,n){a[t]=n},this.setAdditionalPointCost=function(t,n,e){u[t+"_"+n]=e},this.removeAdditionalPointCost=function(t,n){delete u[t+"_"+n]},this.removeAllAdditionalPointCosts=function(){u={}},this.setIterationsPerCalculation=function(t){l=t},this.avoidAdditionalPoint=function(t,n){r[t+"_"+n]=1},this.stopAvoidingAdditionalPoint=function(t,n){delete r[t+"_"+n]},this.enableCornerCutting=function(){h=!0},this.disableCornerCutting=function(){h=!1},this.stopAvoidingAllAdditionalPoints=function(){r={}},this.findPath=function(n,s,r,a,u){var h=function(t){o?u(t):setTimeout(function(){u(t)})};if(void 0===e)throw new Error("You can't set a path without first calling setAcceptableTiles() on EasyStar.");if(void 0===t)throw new Error("You can't set a path without first calling setGrid() on EasyStar.");if(0>n||0>s||0>r||0>r||n>t[0].length-1||s>t.length-1||r>t[0].length-1||a>t.length-1)throw new Error("Your start or end point is outside the scope of your grid.");if(n===r&&s===a)return h([]),void 0;for(var l=t[a][r],f=!1,y=0;y<e.length;y++)if(l===e[y]){f=!0;break}if(f===!1)return h(null),void 0;var d=new EasyStar.instance;d.openList=new EasyStar.PriorityQueue("bestGuessDistance",EasyStar.PriorityQueue.MIN_HEAP),d.isDoneCalculating=!1,d.nodeHash={},d.startX=n,d.startY=s,d.endX=r,d.endY=a,d.callback=h,d.openList.insert(p(d,d.startX,d.startY,null,i)),c.push(d)},this.calculate=function(){if(0!==c.length&&void 0!==t&&void 0!==e)for(n=0;l>n;n++){if(0===c.length)return;if(o&&(n=0),0!==c[0].openList.length){var r=c[0].openList.shiftHighestPriorityElement(),a=[];r.list=EasyStar.Node.CLOSED_LIST,r.y>0&&a.push({instance:c[0],searchNode:r,x:0,y:-1,cost:i*v(r.x,r.y-1)}),r.x<t[0].length-1&&a.push({instance:c[0],searchNode:r,x:1,y:0,cost:i*v(r.x+1,r.y)}),r.y<t.length-1&&a.push({instance:c[0],searchNode:r,x:0,y:1,cost:i*v(r.x,r.y+1)}),r.x>0&&a.push({instance:c[0],searchNode:r,x:-1,y:0,cost:i*v(r.x-1,r.y)}),f&&(r.x>0&&r.y>0&&(h||d(t,e,r.x,r.y-1)&&d(t,e,r.x-1,r.y))&&a.push({instance:c[0],searchNode:r,x:-1,y:-1,cost:s*v(r.x-1,r.y-1)}),r.x<t[0].length-1&&r.y<t.length-1&&(h||d(t,e,r.x,r.y+1)&&d(t,e,r.x+1,r.y))&&a.push({instance:c[0],searchNode:r,x:1,y:1,cost:s*v(r.x+1,r.y+1)}),r.x<t[0].length-1&&r.y>0&&(h||d(t,e,r.x,r.y-1)&&d(t,e,r.x+1,r.y))&&a.push({instance:c[0],searchNode:r,x:1,y:-1,cost:s*v(r.x+1,r.y-1)}),r.x>0&&r.y<t.length-1&&(h||d(t,e,r.x,r.y+1)&&d(t,e,r.x-1,r.y))&&a.push({instance:c[0],searchNode:r,x:-1,y:1,cost:s*v(r.x-1,r.y+1)})),a.sort(function(t,n){var e=t.cost+g(r.x+t.x,r.y+t.y,c[0].endX,c[0].endY),i=n.cost+g(r.x+n.x,r.y+n.y,c[0].endX,c[0].endY);return i>e?-1:e===i?0:1});for(var u=!1,p=0;p<a.length;p++)if(y(a[p].instance,a[p].searchNode,a[p].x,a[p].y,a[p].cost),a[p].instance.isDoneCalculating===!0){u=!0;break}u&&c.shift()}else{var x=c[0];x.callback(null),c.shift()}}};var y=function(n,i,s,o,a){var u=i.x+s,h=i.y+o;if(void 0===r[u+"_"+h]){if(n.endX===u&&n.endY===h){n.isDoneCalculating=!0;var c=[],l=0;c[l]={x:u,y:h},l++,c[l]={x:i.x,y:i.y},l++;for(var f=i.parent;null!=f;)c[l]={x:f.x,y:f.y},l++,f=f.parent;c.reverse();var y=n,v=c;return y.callback(v),void 0}if(d(t,e,u,h)){var g=p(n,u,h,i,a);void 0===g.list?(g.list=EasyStar.Node.OPEN_LIST,n.openList.insert(g)):g.list===EasyStar.Node.OPEN_LIST&&i.costSoFar+a<g.costSoFar&&(g.costSoFar=i.costSoFar+a,g.parent=i)}}},d=function(t,n,e,i){for(var s=0;s<n.length;s++)if(t[i][e]===n[s])return!0;return!1},v=function(n,e){return u[n+"_"+e]||a[t[e][n]]},p=function(t,n,e,i,s){if(void 0!==t.nodeHash[n+"_"+e])return t.nodeHash[n+"_"+e];var o=g(n,e,t.endX,t.endY);if(null!==i)var r=i.costSoFar+s;else r=o;var a=new EasyStar.Node(i,n,e,r,o);return t.nodeHash[n+"_"+e]=a,a},g=function(t,n,e,i){return Math.sqrt((e-=t)*e+(i-=n)*i)}};

var Camera = (function Camera() {
  function Camera(options) {
    this.game = null;
    this.actorToFollow = null;
    
    this.lerpAlpha = 1;
    
    this.x = 0;
    this.y = 0;
    this.targetPosition = {
      'x': 0,
      'y': 0
    };
    
    this.init(options);
  }
  
  Camera.prototype.init = function init(options) {
    !options && (options = {});
    
    this.game = options.game;
  };
  
  Camera.prototype.setActorToFollow = function setActorToFollow(actor) {
    this.actorToFollow = actor;
    this.focusOnActor();
  };
  
  Camera.prototype.focusOnActor = function focusOnActor() {
    if (this.actorToFollow) {
      var position = this.actorToFollow.position;
      this.x = utils.clamp(-game.width / 2 + position.x, 0, game.bleed.x);
      this.y = utils.clamp(-game.height / 2 + position.y, 0, game.bleed.y);
    }
  };
  
  Camera.prototype.onResize = function onResize() {
    this.focusOnActor();
  };
  
  Camera.prototype.update = function update(dt) {
    var game = this.game;
    
    if (this.actorToFollow) {
      var position = this.actorToFollow.position;
      this.targetPosition.x = utils.clamp(-game.width / 2 + position.x, 0, game.bleed.x);
      this.targetPosition.y = utils.clamp(-game.height / 2 + position.y, 0, game.bleed.y);
    }
    
    var distX = this.targetPosition.x - this.x;
    var distY = this.targetPosition.y - this.y;
    
    if (distX) {
      this.x += distX * this.lerpAlpha;
      
      if (Math.abs(distX) < 1) {
        this.x = this.targetPosition.x;
      }
    }
    if (distY) {
      this.y += distY * this.lerpAlpha;
      
      if (Math.abs(distY) < 1) {
        this.y = this.targetPosition.y;
      }
    }
    
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    
    game.log('camera: ' + this.x + ',' + this.y);
  };
  
  Camera.prototype.updateConfigFromGame = function updateConfigFromGame() {
    var config = this.game.config;
    
    this.lerpAlpha = config.lerpAlpha || 1;
  };

  return Camera;
}());

/* Base class for every Object and Character */
var Actor = (function Actor() {
  function Actor(options) {
    this.id = '';
    this.tooltip = '';
    this.direction = '';
    this.isBlocking = false;
    
    this.texture = null;
    this.textureOver = null;
    this.textureDirClips = null;
    this.speed = 0;
    
    this.targetTile = null;
    this.targetPosition = null;
    this.onReachTarget = null;
    
    this.isPointerOver = false;
    
    this.tile = {
      'x': 0,
      'y': 0
    };
    this.position = {
      'x': 0,
      'y': 0
    };
    this.pathToWalk = null;
    
    this.modules = [];
    
    this.isReady = false;
    
    this.init(options);
  }
  
  Actor.prototype.init = function init(options) {
    !options && (options = {});
    
    this.id = options.id || 'actor_' + Date.now() + '_' + Math.random();
    this.tooltip = options.tooltip || '';
    this.layer = options.layer;
    this.game = this.layer.game;
    this.speed = options.speed || 0;
    this.isBlocking = 'isBlocking' in options? options.isBlocking : false;
    this.textureDirClips = options.textureDirClips || null;
    this.tile = options.tile || {
      'x': 0,
      'y': 0
    };
    
    this.position = this.game.getCoordsFromTile(this.tile);

    this.initModules(options.modules || []);

    this.texture = new Texture(options.texture);
    
    if (options.textureOver) {
      this.textureOver = new Texture(options.textureOver);
    }
    
    this.setDirection(options.direction || 'top');
    
    console.log('[Actor] create', this);
  };
  
  Actor.prototype.setDirection = function setDirection(direction) {
    if (this.direction === direction) {
      return;
    }

    this.direction = direction;
    
    var clips = this.textureDirClips;
    if (clips) {
      var dirClip = clips[direction];
      if (dirClip) {
        this.texture.clip = dirClip;
      }
    }
    
    return true;
  };
  
  Actor.prototype.initModules = function initModules(modules) {
    for (var i = 0, len = modules.length; i < len; i++) {
      var moduleData = modules[i];
      var moduleConfig = this.game.getModuleConfig(moduleData.type);
      
      if (!moduleConfig) {
        console.warn('No module found in game config', moduleData);
        continue;
      }
      
      if (!window[moduleConfig.className]) {
        console.warn('No class found for module', moduleData);
        continue;
      }
      
      moduleData.actor = this;
      
      var module = new window[moduleConfig.className](moduleData);
      this.modules.push(module);
    }
    
    return true;
  };
  
  Actor.prototype.onClick = function onClick(e) {
    var wasClickHandled = false;
    
    for (var i = 0, len = this.modules.length; i < len; i++) {
      var module = this.modules[i];
      if (module.onClick && module.onClick(e)) {
        wasClickHandled = true;
      }
    }
    
    return wasClickHandled;
  };
  
  Actor.prototype.moveTo = function moveTo(targetTile, onReach) {
    if (this.speed === 0) {
      console.warn('Trying to move an actor with no speed', targetTile, this);
      return false;
    }
    
    if (utils.tilesEqual(targetTile, this.tile)) {
      onReach && onReach();
    } else {
      this.onReachTarget = onReach;
      this.game.navMesh.findPath(this.tile, targetTile, this.onGotPath.bind(this));
      
      console.log(this.id, 'move actor to', this.targetTile, this.targetPosition);
    }
    
    return true;
  };
  
  Actor.prototype.onGotPath = function onGotPath(path) {
    this.pathToWalk = path;
    
    if (path && path.length > 0) {
      this.targetTile = path[0];
      this.targetPosition = this.game.getCoordsFromTile(path[0]);
    } else {
      this.pathToWalk = null;
      this.targetTile = null;
      this.targetPosition = null;
      this.onReachTarget = null;
    }
  };
  
  Actor.prototype.update = function update(dt) {
    var game = this.game;
    
    game.startBenchmark('update', this.id);
    
    this.isPointerOver = this.id in game.actorsUnderPointer;
    
    if (this.pathToWalk) {
      var speed = this.speed * dt;
      
      if (game.distance(this.targetPosition, this.position) <= speed) {
        this.position = this.targetPosition;
        this.tile = this.targetTile;
        
        if (this.pathToWalk.length > 0) {
          this.targetTile = this.pathToWalk.splice(0, 1)[0];
          this.targetPosition = this.game.getCoordsFromTile(this.targetTile);
        } else {
          this.targetTile = null;
          this.targetPosition = null;
          this.pathToWalk = null;
  
          if (this.onReachTarget) {
            this.onReachTarget(this);
          }
        }
      } else {
        var distX = this.targetPosition.x - this.position.x;
        var distY = this.targetPosition.y - this.position.y;
        
        if (distX <= -speed) {
          this.setDirection('left');
          this.position.x -= speed;
        } else if (distX >= speed) {
          this.setDirection('right');
          this.position.x += speed;
        } else {
          if (this.position.x !== this.targetPosition.x) {
            this.position.x = this.targetPosition.x;
          }
            
          if (distY <= -speed) {
            this.setDirection('top');
            this.position.y -= speed;
          } else if (distY >= speed) {
            this.setDirection('bottom');
            this.position.y += speed;
          }
        }
      }
    }

    var modules = this.modules;
    for (var i = 0, len = modules.length; i < len; i++) {
      var module = modules[i];
      module.update && module.update(dt);
    }
    
    this.game.endBenchmark('update', this.id);
    
    return true;
  };
  
  Actor.prototype.draw = function draw(layer) {
    var game = this.game;
    var context = this.layer.context;
    var drawPosition = game.getOffsetPosition(this.position);
    var texture = this.isPointerOver && this.textureOver? this.textureOver : this.texture;
    var x = drawPosition.x;
    var y = drawPosition.y;
    
    // Don't draw out of bounds actors
    if (x > game.width || x + this.width < 0 ||
        y > game.height || y + this.height < 0) {
      return true;
    }
    
    game.startBenchmark('draw', this.id);

    if (DEBUG) {
      context.beginPath();
      context.fillStyle = 'rgba(255, 0, 0, .6)';
      context.strokeStyle = 'rgba(255, 0, 0, .6)';
      context.arc(drawPosition.x, drawPosition.y, 2, 0, Math.PI * 2);
      context.fill();
    
      if (this.pathToWalk) {
        context.fillStyle = 'rgba(0, 0, 255, 1)';
        context.beginPath();
        
        var size = this.game.config.tileSize;
        var camera = this.game.camera;
        
        for (var i = 0, len = this.pathToWalk.length; i < len; i++) {
          var pathX = this.pathToWalk[i].x * size - camera.x;
          var pathY = this.pathToWalk[i].y * size - camera.y;
          context.moveTo(pathX + size / 2, pathY + size / 2);
          context.arc(pathX + size / 2, pathY + size / 2, 5, 0, Math.PI * 2);
        }
        
        context.fill();
      }
    }

    texture.draw(context, x, y);
    
    game.endBenchmark('draw', this.id);
    
    return true;
  };
  
  return Actor;
}());

var Texture = (function Texture() {
  function Texture(options, onLoad) {
    this.src = '';
    this.origin = [0.5, 0.5];
    this.drawOrigin = [0.5, 0.5];
    this.clip = null;
    
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    
    this.init(options, onLoad);
  }
  
  Texture.prototype.textures = {};
  
  Texture.prototype.init = function init(options) {
    this.src = options.src;
    this.origin = options.origin || [0.5, 0.5];
    this.width = options.width || 0;
    this.height = options.height || 0;
    this.clip = options.clip || [0, 0];
    this.scale = options.scale || 1;
    
    var image = Texture.prototype.textures[this.src];
    if (image) {
      if (image.isReady) {
        this.onLoad();
      } else {
        image.addEventListener('load', this.onLoad.bind(this));
      }
    } else {
      image = new Image();
      image.addEventListener('load', this.onLoad.bind(this));
      image.addEventListener('error', this.onError.bind(this));
      image.src = this.src;
      
      Texture.prototype.textures[this.src] = image;
    }
    
    console.log('[Texture] create', this);
  };
  
  Texture.prototype.draw = function draw(context, x, y) {
    var image = Texture.prototype.textures[this.src];
    
    if (!image.isReady) {
      return false;
    }
    
    var origin = this.drawOrigin;
    var clip = this.clip;
    var width = this.width;
    var height = this.height;
    var scale = this.scale;
    
    x -= origin[0] * scale;
    y -= origin[1] * scale;
    
    context.drawImage(image,
                      // Draw this
                      clip[0], clip[1],
                      width, height,
                      // Here
                      x, y,
                      width * scale, height * scale);
    
    if (DEBUG) {
      game.stats.textures++;
    }
    
    return true;
  };
  
  Texture.prototype.onLoad = function onLoad() {
    var image = Texture.prototype.textures[this.src];

    image.isReady = true;
    
    if (!this.width) {
      this.width = image.width;
    }
    if (!this.height) {
      this.height = image.height;
    }

    this.drawOrigin[0] = this.width * this.origin[0];
    this.drawOrigin[1] = this.height * this.origin[1];
  };
  
  Texture.prototype.onError = function onError() {
    console.error('Error trying to load texture', this);
  };
  
  return Texture;
}());

/* ActorModule is attached to actors as a member */
var ActorModule = (function ActorModule() {
  function ActorModule(options) {
    this.type = '';
    this.actor = null;
    
    this.init(options);
  }
  
  ActorModule.prototype.init = function init(options) {
    this.type = options.type;
    this.actor = options.actor;
  };

  return ActorModule;
}());

/* Interactable - NPC you can talk to */
var ModuleInteractable = (function ModuleInteractable() {
  function ModuleInteractable(options) {
    this.useDir = '';
    this.useOffset = {
      'x': 0,
      'y': 0
    };
    
    ActorModule.call(this, options);
  }
  
  ModuleInteractable.prototype = Object.create(ActorModule.prototype);
  ModuleInteractable.prototype.constructor = ModuleInteractable;
  
  ModuleInteractable.prototype.init = function init(options) {
    ActorModule.prototype.init.apply(this, arguments);
    
    !options && (options = {});

    this.useDir = options.useDir || '';
    this.useOffset = options.useOffset || {
      'x': 0,
      'y': 0
    };
  };
  
  ModuleInteractable.prototype.onClick = function onClick(e) {
    var game = this.actor.game;
    
    var goToTile = {
      'x': this.actor.tile.x + this.useOffset.x,
      'y': this.actor.tile.y + this.useOffset.y
    };
    
    game.playerController.moveTo(goToTile, this.activate.bind(this));
    
    return true;
  };
  
  ModuleInteractable.prototype.activate = function activate() {
    if (this.useDir) {
      var player = this.actor.game.playerController.controlledActor;
      if (player) {
        player.setDirection(this.useDir);
      }
    }
  };
  
  return ModuleInteractable;
}());

/* Interactable - NPC you can talk to */
var ModuleDialog = (function ModuleDialog() {
  function ModuleDialog(options) {
    this.dialogId = '';
    this.dialog = null;
    
    ModuleInteractable.call(this, options);
  }
  
  ModuleDialog.prototype = Object.create(ModuleInteractable.prototype);
  ModuleDialog.prototype.constructor = ModuleDialog;
  
  ModuleDialog.prototype.init = function init(options) {
    ModuleInteractable.prototype.init.apply(this, arguments);
    
    this.dialogId = options.dialogId;
    this.dialog = this.actor.game.currentMap.dialogs[this.dialogId];
    
    if (!this.dialog) {
      console.warn('Cant find requested dialog', this);
    }
  };
  
  ModuleDialog.prototype.activate = function activate(e) {
    ModuleInteractable.prototype.activate.apply(this, arguments);
    
    console.warn(this.dialog);
  };
  
  return ModuleDialog;
}());

/* Interactable - Web Page you can open */
var ModuleWebPage = (function ModuleWebPage() {
  function ModuleWebPage(options) {
    this.url = '';
    this.isInFrame = false;
    this.scale = 1;
    
    ModuleInteractable.call(this, options);
  }
  
  ModuleWebPage.prototype = Object.create(ModuleInteractable.prototype);
  ModuleWebPage.prototype.constructor = ModuleWebPage;
  
  ModuleWebPage.prototype.init = function init(options) {
    ModuleInteractable.prototype.init.apply(this, arguments);
    
    this.url = options.url || '';
    this.isInFrame = options.hasOwnProperty('isInFrame')? options.isInFrame : false;
    this.scale = options.scale || 0.9;
  };
  
  ModuleWebPage.prototype.activate = function activate(e) {
    ModuleInteractable.prototype.activate.apply(this, arguments);
    
    if (this.isInFrame) {
      var actor = this.actor;
      var parentEl = actor.game.el;
      var width = parentEl.offsetWidth * this.scale;
      var height = parentEl.offsetHeight * this.scale;
      
      this.frame = document.createElement('iframe');
      this.frame.className = 'game-webpage-frame';
      this.frame.style.width = width + 'px';
      this.frame.style.height = height + 'px';
      
      parentEl.appendChild(this.frame);
      
      this.frame.src = this.url;
    } else {
      window.open(this.url, '_blank');
    }
  };
  
  return ModuleWebPage;
}());

/* Controls a given Actor */
var PlayerController = (function PlayerController() {
  function PlayerController(options) {
    this.game = null;
    this.controlledActor = null;
    
    this.boundToGame = true;
    
    this.pointer = {
      'x': 0,
      'y': 0
    };
    
    this.pathToWalk = null;
    this.timeoutMove = null;
    
    this.init(options);
  }
  
  PlayerController.prototype.init = function init(options) {
    this.game = options.game;
    
    this.boundToGame = typeof options.boundToGame === 'boolean'? options.boundToGame : true;
    
    InputManager.listenTo(this.game.el);
  };
  
  PlayerController.prototype.setControlledActor = function setControlledActor(actor) {
    this.controlledActor = actor;
  };
  
  PlayerController.prototype.getActor = function getActor() {
    return this.controlledActor;
  };
  
  PlayerController.prototype.moveTo = function moveTo(position, onReach) {
    var actor = this.controlledActor;
    if (actor) {
      actor.moveTo(position, onReach);
    }
  };
  
  PlayerController.prototype.update = function update(dt) {
    var game = this.game;
    var camera = this.game.camera;
    
    this.pointer.x = InputManager.mousePosition.x + camera.x - game.offset.x;
    this.pointer.y = InputManager.mousePosition.y + camera.y - game.offset.y;

    if (this.boundToGame) {
      var tileSize = game.config.tileSize;
      this.pointer.x = utils.clamp(this.pointer.x, 0, game.width + game.bleed.x - tileSize);
      this.pointer.y = utils.clamp(this.pointer.y, 0, game.height + game.bleed.y - tileSize);
    }
    
    if (DEBUG) {
      game.log('pointer: ' + this.pointer.x + ',' + this.pointer.y);
    }
  };
  
  return PlayerController;
}());

var NavMesh = (function NavMesh() {
  function NavMesh(options) {
    this.mesh = [];
    this.pathFinding = null;
    
    this.init(options);
  }
  
  NavMesh.prototype.init = function init(options) {
    this.game = options.game;
    this.pathFinding = new EasyStar.js();
    this.pathFinding.setAcceptableTiles([true]);
  };
  
  NavMesh.prototype.isBlocked = function isBlocked(tile) {
    return !this.mesh[tile.y][tile.x];
  };
  
  NavMesh.prototype.findPath = function findPath(from, to, callback) {
    if (!callback) {
      console.warn('Trying to find path without callback', arguments);
      return false;
    }
    
    console.log('Find path from', from, 'to', to);
    
    this.pathFinding.findPath(from.x, from.y, to.x, to.y, function onCalculated(path) {
      if (path === null) {
        console.warn('no path found');
      } else {
        path.splice(0, 1);
      }
      
      callback && callback(path);
    });
    
    this.pathFinding.calculate();
    
    return true;
  };
  
  NavMesh.prototype.update = function update() {
    var game = this.game;
    var map = game.currentMap;
    var grid = map.grid;
    var tilesMap = this.game.tiles;
    
    this.mesh = [];
    
    for (var i = 0, numberOfRows = grid.length; i < numberOfRows; i++) {
      var row = grid[i];
      var meshRow = [];
      
      for (var j = 0, numberOfCols = row.length; j < numberOfCols; j++) {
        var tile = tilesMap[row[j]];
        
        if (tile) {
          if (tile.isBlocking) {
            meshRow.push(false);
          } else {
            var actors = game.getActorsOnTile({
              'x': j,
              'y': i
            });
            
            if (actors.length === 0) {
              meshRow.push(true);
            } else {
              var isBlocking = false;
              
              for (var iActor = 0, len = actors.length; iActor < len; iActor++) {
                var actor = actors[iActor];
                
                if (actor.isBlocking) {
                  isBlocking = true;
                  break;
                }
              }
              
              meshRow.push(!isBlocking);
            }
          }
        }
      }
      
      this.mesh.push(meshRow);
    }
    
    this.pathFinding.setGrid(this.mesh);
    
    console.info('Generated mesh', this.mesh);
  };

  return NavMesh;
}());

var InputManager = (function InputManager() {
  function InputManager() {
    this.listeners = {
      'pressed': {},
      'released': {}
    };

    this.isLeftMouseButtonDown = false;
    this.isMiddleMouseButtonDown = false;
    this.isRightMouseButtonDown = false;
    this.mousePosition = {
      'x': 0,
      'y': 0
    };
    
    this.actionKeys = {};
    this.keyToAction = {};
    this.actionsActive = {};

    this.KEYS_DOWN = {};

    this.CODE_TO_KEY = {};

    this.KEYS = {
      LEFT_MOUSE_BUTTON: -1,
      MIDDLE_MOUSE_BUTTON: -2,
      RIGHT_MOUSE_BUTTON: -3,
      
      TAB: 9,
      ENTER: 13,
      SHIFT: 16,
      CTRL: 17,
      ALT: 18,
      
      SPACE: 32,

      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      
      NUMBER_0: 48,
      NUMBER_1: 49,
      NUMBER_2: 50,
      NUMBER_3: 51,
      NUMBER_4: 52,
      NUMBER_5: 53,
      NUMBER_6: 54,
      NUMBER_7: 55,
      NUMBER_8: 56,
      NUMBER_9: 57,

      A: 65,
      B: 66,
      C: 67,
      D: 68,
      E: 69,
      F: 70,
      G: 71,
      H: 72,
      I: 73,
      J: 74,
      K: 75,
      L: 76,
      M: 77,
      N: 78,
      O: 79,
      P: 80,
      Q: 81,
      R: 82,
      S: 83,
      T: 84,
      U: 85,
      V: 86,
      W: 87,
      X: 88,
      Y: 89,
      Z: 90,
      
      NUMPAD_0: 96,
      NUMPAD_1: 97,
      NUMPAD_2: 98,
      NUMPAD_3: 99,
      NUMPAD_4: 100,
      NUMPAD_5: 101,
      NUMPAD_6: 102,
      NUMPAD_7: 103,
      NUMPAD_8: 104,
      NUMPAD_9: 105,
      NUMPAD_MULTIPLY: 106,
      NUMPAD_PLUS: 107,
      NUMPAD_MINUS: 109,
      NUMPAD_DECIMAL: 110
    };
    
    this.KEY_NAMES = {};
    this.KEY_NAMES[this.KEYS.LEFT_MOUSE_BUTTON] = 'Left Mouse Button';
    this.KEY_NAMES[this.KEYS.MIDDLE_MOUSE_BUTTON] = 'Middle Mouse Button';
    this.KEY_NAMES[this.KEYS.RIGHT_MOUSE_BUTTON] = 'Right Mouse Button';
    this.KEY_NAMES[this.KEYS.SHIFT] = 'Shift';
    this.KEY_NAMES[this.KEYS.LEFT] = '&#8592;';
    this.KEY_NAMES[this.KEYS.UP] = '&#8593;';
    this.KEY_NAMES[this.KEYS.RIGHT] = '&#8594;';
    this.KEY_NAMES[this.KEYS.DOWN] = '&#8595;';
    this.KEY_NAMES[this.KEYS.W] = 'W';
    this.KEY_NAMES[this.KEYS.D] = 'D';
    this.KEY_NAMES[this.KEYS.S] = 'S';
    this.KEY_NAMES[this.KEYS.A] = 'A';
    this.KEY_NAMES[this.KEYS.NUMBER_1] = '1';
    this.KEY_NAMES[this.KEYS.NUMBER_2] = '2';
    this.KEY_NAMES[this.KEYS.NUMBER_3] = '3';
    this.KEY_NAMES[this.KEYS.NUMBER_4] = '4';
    this.KEY_NAMES[this.KEYS.NUMBER_5] = '5';
    this.KEY_NAMES[this.KEYS.NUMBER_6] = '6';
    this.KEY_NAMES[this.KEYS.NUMBER_7] = '7';
    this.KEY_NAMES[this.KEYS.NUMBER_8] = '8';
    this.KEY_NAMES[this.KEYS.NUMBER_9] = '9';
    this.KEY_NAMES[this.KEYS.NUMBER_0] = '0';
    
    this.mouseButtonKeys = [
      this.KEYS.LEFT_MOUSE_BUTTON,
      this.KEYS.MIDDLE_MOUSE_BUTTON,
      this.KEYS.RIGHT_MOUSE_BUTTON
    ];

    this.init();
  }

  InputManager.prototype.init = function init() {
    for (var k in this.KEYS) {
      this[k] = false;
      this.CODE_TO_KEY[this.KEYS[k]] = k;
    }
  };
  
  InputManager.prototype.getActionKey = function getActionKey(actionName) {
    return this.actionKeys[actionName];
  };
  
  InputManager.prototype.bindAction = function bindAction(actionName, keys) {
    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    
    this.actionKeys[actionName] = keys;
    
    for (var i = 0, len = keys.length; i < len; i++) {
      this.keyToAction[keys[i]] = actionName;
    }
  };
  
  InputManager.prototype.getBoundActions = function getBoundActions() {
    return this.actionKeys;
  };
  
  InputManager.prototype.getKeyName = function getKeyName(key) {
    return this.KEY_NAMES[key];
  };
  
  InputManager.prototype.listenTo = function listenTo(el) {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    el.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('mousewheel', this.onMouseWheel.bind(this));
    
    el.addEventListener('contextmenu', function onContextMenu(e) {
      e.preventDefault();
    });
  };

  InputManager.prototype.on = function on(event, actionName, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = {};
    }
    if (!this.listeners[event][actionName]) {
      this.listeners[event][actionName] = [];
    }

    this.listeners[event][actionName].push(callback);
  };

  InputManager.prototype.onMouseMove = function onMouseMove(e) {
    this.mousePosition.x = e.pageX;
    this.mousePosition.y = e.pageY;
  };

  InputManager.prototype.onMouseDown = function onMouseDown(e) {
    var key = this.mouseButtonKeys[e.button];
    if (typeof key === 'number') {
      this.setKeyStatus(key, true);
    }
  };

  InputManager.prototype.onMouseUp = function onMouseUp(e) {
    var key = this.mouseButtonKeys[e.button];
    if (typeof key === 'number') {
      this.setKeyStatus(key, false);
    }
  };

  InputManager.prototype.onMouseWheel = function onMouseWheel(e) {
    var isUp = e.deltaY < 0,
        listeners = (this.listeners['mousewheel'] || {})[isUp? 'up' : 'down'] || []; 

    for (var i = 0, len = listeners.length; i < len; i++) {
      listeners[i](e);
    }
  };

  InputManager.prototype.onKeyDown = function onKeyDown(e) {
    this.setKeyStatus(e.keyCode, true);
  };

  InputManager.prototype.onKeyUp = function onKeyUp(e) {
    this.setKeyStatus(e.keyCode, false);
  };
  
  InputManager.prototype.setKeyStatus = function setKeyStatus(key, isDown) {
    var isFirstPress = !this.KEYS_DOWN[key];
    var actionName = this.keyToAction[key];
    
    this.KEYS_DOWN[key] = isDown;
    this[this.CODE_TO_KEY[key]] = isDown;
    
    if (actionName) {
      this.actionsActive[actionName] = isDown;

      if (isFirstPress || !isDown) {
        var listeners = this.listeners[isDown? 'pressed' : 'released'][actionName];
        
        if (listeners) {
          for (var i = 0, len = listeners.length; i < len; i++) {
            listeners[i]();
          }
        }
      }
    }
  };
  
  InputManager.prototype.isRightClick = function isRightClick(button) {
    if (typeof button !== 'number') {
      button = button.button;
    }
    
    return (button === 2);
  };
  
  InputManager.prototype.isLeftClick = function isLeftClick(button) {
    if (typeof button !== 'number') {
      button = button.button;
    }
    
    return (button === 0);
  };

  return new InputManager();
}());