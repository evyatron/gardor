/* global DEBUG */
/* global DEBUG_NAVMESH */
/* global EventDispatcher */
/* global utils */


/* Main game class, magic happens here */
var Game = (function Game() {
  function Game(options) {
    this.el = null;
    
    this.lastUpdate = 0;
    this.dt = 0;
    this.timeDialation = 1;
    this.isReady = false;
    this.layers = {};
    
    this.width = 0;
    this.height = 0;
    this.mapWidth = 0;
    this.mapHeight = 0;
    this.containerWidth = 0;
    this.containerHeight = 0;
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
    this.maps = {};
    this.config = null;
    
    this.camera = null;
    this.playerController = null;
    this.navMesh = null;
    
    this.clickTexture = null;
    this.timeToShowClickTexture = 0;
    this.timeShownClickTexture = 0;
    
    this.actorsUnderPointer = {};

    this.stats = {
      'update': {},
      'draw': {},
      'textures': 0
    };
    this.runningBenchmarks = {};
    
    this.EVENTS = {
      CLICK: 'click',
      CLICK_SECONDARY: 'clickSecondary',
      CREATE: 'create',
      MAP_CREATE: 'mapCreated',
      POINTER_TILE_CHANGE: 'pointerTileChange',
      READY: 'ready'
    };
    
    this.GOTO_MAP_RESULT = {
      SUCCESS: 0,
      NOT_LOADED: 1,
      LOADING: 2,
      ERROR: 3
    };
    
    this.SCRIPTS = [
      '/js/Actor.js',
      '/js/ActorModules.js',
      '/js/Camera.js',
      '/js/InputManager.js',
      '/js/Layers.js',
      '/js/NavMesh.js',
      '/js/PlayerController.js',
      '/js/Texture.js'
    ];
    
    this.isRunning = false;
    
    EventDispatcher.apply(this);

    this.init(options);
  }
  
  Game.prototype = Object.create(EventDispatcher.prototype);
  Game.prototype.constructor = Game;
  
  Game.prototype.init = function init(options) {
    !options && (options = {});
    
    this.setDebug(options.hasOwnProperty('debug')? options.debug : /DEBUG/.test(window.location.search));
    this.setDebugNavmesh(options.hasOwnProperty('debugNavmesh')? options.debugNavmesh : /DEBUG_NAVMESH/.test(window.location.search));
    
    this.el = options.el || document.body;
    this.configSrc = options.config;
    
    utils.loadScripts(this.SCRIPTS, this.onScriptsLoaded.bind(this));
  };
  
  Game.prototype.onScriptsLoaded = function onScriptsLoaded() {;
    this.playerController = new PlayerController({
      'game': this
    });
    
    this.camera = new Camera({
      'game': this
    });
    
    this.navMesh = new NavMesh({
      'game': this
    });
    
    window.addEventListener('resize', this.onResize.bind(this));
    this.onResize();
    
    if (this.configSrc) {
      this.loadConfig(this.configSrc);
    }
    
    this.dispatch(this.EVENTS.READY);
  };
  
  Game.prototype.destroy = function destroy() {
    this.isRunning = false;
    
    delete window.DEBUG;
    delete window.DEBUG_NAVMESH;
    
    for (var id in this.layers) {
      var layer = this.layers[id];
      if (layer.canvas) {
        layer.canvas.parentNode.removeChild(layer.canvas);
      }
    }
    
    this.el.style.width = '';
    this.el.style.height = '';
    
    this.removeEventListeners();
  };
  
  Game.prototype.setDebug = function setDebug(isDebug) {
    window.DEBUG = isDebug;
    if (this.layers.background) {
      this.layers.background.createTexture();
    }
  };
  
  Game.prototype.setDebugNavmesh = function setDebugNavmesh(isDebug) {
    window.DEBUG_NAVMESH = isDebug;
    if (this.layers.background) {
      this.layers.background.createTexture();
    }
  };
  
  Game.prototype.createGame = function createGame() {
    this.camera.updateConfigFromGame();
    
    this.clickTexture = this.config.clickTexture;
    this.timeToShowClickTexture = this.config.timeToShowClickTexture || 1;
    
    this.setTiles(this.config.tiles);

    if (this.config.startingMap) {
      this.goToMap(this.config.startingMap);
    }
    
    this.isReady = true;
    this.dispatch(this.EVENTS.CREATE, this);

    this.isRunning = true;
    this.lastUpdate = Date.now();
    window.requestAnimationFrame(this.tick.bind(this));
  };
  
  Game.prototype.setTiles = function setTiles(tiles) {
    var tileSize = this.config.tileSize;
    for (var i = 0, len = tiles.length; i < len; i++) {
      var tile = JSON.parse(JSON.stringify(tiles[i]));
      tile.texture.width = tileSize;
      tile.texture.height = tileSize;
      tile.texture.origin = {
        'x': 0,
        'y': 0
      };
      tile.texture.game = this;
      tile.texture = new Texture(tile.texture);
      this.tiles[tile.id] = tile;
    }
    
    if (this.layers.background) {
      this.layers.background.createTexture();
    }
    
    this.navMesh.update();
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
    
    if (!map.grid || map.grid.length === 0) {
      console.warn('Got map without grid!', map);
      return this.GOTO_MAP_RESULT.ERROR;
    }
    
    this.currentMap = map;
    
    this.mapWidth = map.grid[0].length * this.config.tileSize;
    this.mapHeight = map.grid.length * this.config.tileSize;

    this.onResize();
    
    if (!this.layers.background) {
      this.layers.background = new TilesetLayer({
        'id': 'background',
        'game': this
      });
    }
    if (!this.layers.actors) {
      this.layers.actors = new Layer({
        'id': 'actors',
        'game': this
      });
    }
    if (!this.layers.hud) {
      this.layers.hud = new HUDLayer({
        'id': 'hud',
        'game': this
      });
    }

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
    
    this.dispatch(this.EVENTS.MAP_CREATE, this);
    
    console.info('Finished loading map', this.currentMap);
  };
  
  Game.prototype.getModuleConfig = function getModuleConfig(moduleId) {
    return this.modules[moduleId];
  };
  
  Game.prototype.tick = function tick() {
    var now = Date.now();
    
    this.dt = (now - this.lastUpdate) / 1000 * this.timeDialation;
    
    this.log('dt: ' + this.dt);
    
    this.stats.textures = 0;

    // Update - logic
    this.update(this.dt);
    // Draw - only drawing - no logic should be done here
    this.draw();
    
    this.log('update: ' + this.stats.update.time + 'ms');
    this.log('draw: ' + this.stats.draw.time + 'ms');
    this.log('textures: ' + this.stats.textures);
    
    // Next tick please
    if (this.isRunning) {
      this.lastUpdate = now;
      window.requestAnimationFrame(this.tick.bind(this));
    }
  };
  
  Game.prototype.update = function update(dt) {
    this.runningBenchmarks = {};
    
    this.startBenchmark('global', 'update');
    
    // Update player controller to check for input
    this.playerController.update(dt);
    
    // Save pointer tile and actors under it
    var newPointerTile = this.getPointerTile();
    if (!utils.tilesEqual(this.pointerTile, newPointerTile)) {
      this.pointerTile = newPointerTile;
      
      this.actorsUnderPointer = {};
      var actorsUnderPointer = this.getActorsOnTile(this.getPointerTile());
      for (var i = 0, len = actorsUnderPointer.length; i < len; i++) {
        this.actorsUnderPointer[actorsUnderPointer[i].id] = actorsUnderPointer[i];
      }
      
      this.dispatch(this.EVENTS.POINTER_TILE_CHANGE, {
        'tile': newPointerTile,
        'actors': this.actorsUnderPointer
      });
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
    
    var layers = this.layers;
    var id;
    
    for (id in layers) {
      layers[id].clear();
    }
    for (id in layers) {
      layers[id].draw();
    }
    
    this.stats.draw = this.endBenchmark('global', 'draw');
  };
  
  Game.prototype.handlePrimaryAction = function handlePrimaryAction(e) {
    var clickedTile = this.getPointerTile();
    var actors = this.getActorsOnTile(clickedTile);
    var wasClickHandled = false;
    
    if (this.playerController.isActive) {
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
    }
    
    this.dispatch(this.EVENTS.CLICK, {
      'event': e,
      'tile': clickedTile,
      'actors': actors,
      'isPlayerControllerActive': this.playerController.isActive
    });
  };
  
  Game.prototype.handleSecondaryAction = function handleSecondaryAction(e) {
    var clickedTile = this.getPointerTile();
    var actors = this.getActorsOnTile(clickedTile);
    
    this.dispatch(this.EVENTS.CLICK_SECONDARY, {
      'event': e,
      'tile': clickedTile,
      'actors': actors,
      'isPlayerControllerActive': this.playerController.isActive
    });
  };
  
  Game.prototype.getActor = function getActor(actorId) {
    var actors = (this.layers.actors || {}).actorsMap;
    return actors[actorId] || null;
  };
  
  Game.prototype.getActorsOnTile = function getActorsOnTile(tile) {
    var actorsOnTile = [];
    var actors = (this.layers.actors || {}).actorsMap || {};
    
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
      'x': Math.floor((tile.x * size) + size / 2),
      'y': Math.floor((tile.y * size) + size / 2)
    };
  };

  Game.prototype.getHUD = function getHUD() {
    return this.layers.hud;
  };
  
  Game.prototype.distance = function distance(from, to) {
    var distX = to.x - from.x;
    var distY = to.y - from.y;
    
    return Math.sqrt(distX * distX + distY * distY);
  };
  
  Game.prototype.drawText = function drawText(context, text, x, y, font, lineSpacing) {
    context.font = font || this.config.defaultFont;

    var textLines = text.split("\n");
    var lineHeight = parseInt(context.font, 10) + (lineSpacing || 0);
    
    //var fillStyle = context.fillStyle;
    //var highlightFillStyle = this.config.tooltips.highlightColor;
    
    for (var i = 0, len = textLines.length; i < len; i++) {
      var formattedText = textLines[i];
      /*
      var formattedTextParts = [];
      
      formattedText = formattedText.replace(/<b>[^\<]*<\/b>/g, function(whole, match) {
        console.warn(arguments);
        formattedTextParts.push({
          'text': match,
          'isHighlighted': true
        });
        return match;
      });
      
      console.warn(formattedTextParts)
      */

      context.fillText(formattedText, x, y + lineHeight * i);
    }
  };
  
  Game.prototype.measureText = function measureText(context, text, lineSpacing) {
    var height = 0;
    var width = 0;
    var textLines = text.split("\n");
    
    if (!lineSpacing) {
      lineSpacing = 0;
    }
    
    var fontHeight = parseInt(context.font, 10);
    
    height = textLines.length * fontHeight +
            (textLines.length - 1) * lineSpacing;
    
    for (var i = 0, len = textLines.length; i < len; i++) {
      width = Math.max(width, context.measureText(textLines[i]).width);
    }
    
    return {
      'height': height,
      'width': width
    };
  };
  
  Game.prototype.getDialog = function getDialog(dialogId) {
    var dialogs = (this.currentMap || {}).dialogs || [];
    var dialog = null;
    
    for (var i = 0, len = dialogs.length; i < len; i++) {
      if (dialogs[i].id === dialogId) {
        dialog = dialogs[i];
        break;
      }
    }
    
    return dialog;
  };
  
  Game.prototype.loadMap = function loadMap(mapId, callback) {
    console.log('Get Map:', mapId);
    
    utils.request('/data/' + mapId + '.json', function onMapLoaded(mapData) {
      if (mapData) {
        this.addMap(mapData);
        callback && callback(mapData);
      }
    }.bind(this));
    
    this.maps[mapId] = true;
  };
  
  Game.prototype.addMap = function addMap(map) {
    this.maps[map.id] = map;
  };
  
  Game.prototype.loadConfig = function loadConfig(config) {
    console.log('Get Config:', config);
    
    utils.request(config, this.createGameFromConfig.bind(this));
  };
  
  Game.prototype.createGameFromConfig = function createGameFromConfig(config) {
    console.info('Got Config', config);
    
    this.config = JSON.parse(JSON.stringify(config));
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
    
    if (this.layers.hud) {
      this.layers.hud.writeDebugLine(message);
    }
  };
  
  Game.prototype.onResize = function onResize() {
    console.group('Resize');
    
    var bounds = this.el.getBoundingClientRect();
    var elParent = this.el.parentNode;
    var padding = this.currentMap && this.currentMap.padding || 0;
    
    this.containerWidth = elParent.offsetWidth;
    this.containerHeight = elParent.offsetHeight;
    
    if (this.containerWidth % 2 === 1) {
      this.containerWidth--;
    }
    if (this.containerHeight % 2 === 1) {
      this.containerHeight--;
    }
    
    console.log('Container: ', this.containerWidth, ',', this.containerHeight);

    if (this.currentMap && this.currentMap.width && this.currentMap.height) {
      this.width = Math.min(this.currentMap.width, this.containerWidth - padding);
      this.height = Math.min(this.currentMap.height, this.containerHeigh - padding);
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
    
    console.log('Game: ', this.width, ',', this.height);
    
    this.bleed.x = this.mapWidth - this.width;
    this.bleed.y = this.mapHeight - this.height;
    
    if (this.bleed.x < 0) {
      this.bleed.x = this.bleed.x / 2;
    }
    if (this.bleed.y < 0) {
      this.bleed.y = this.bleed.y / 2;
    }
    
    console.log('Bleed: ', this.bleed.x, ',', this.bleed.y);

    this.el.style.width = this.containerWidth + 'px';
    this.el.style.height = this.containerHeight + 'px';
    
    this.offset = {
      'x': bounds.left + Math.max((this.containerWidth - this.width) / 2, 0),
      'y': bounds.top + Math.max((this.containerHeight - this.height) / 2, 0)
    };
    
    for (var id in this.layers) {
      var layer = this.layers[id];
      layer.onResize();
      console.log(layer.id, ':', layer.width, ',', layer.height);
    }
    console.groupEnd('Resize');
    
    this.camera.onResize();
  };

  return Game;
}());