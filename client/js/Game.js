/* global DEBUG */
/* global DEBUG_NAVMESH */
/* global EventDispatcher */
/* global utils */
/* global PlayerController */
/* global Camera */
/* global NavMesh */
/* global TilesetLayer */
/* global HUDLayer */
/* global Layer */

"use strict";

/* Main game class, magic happens here */
var Game = (function Game() {
  function Game(options) {
    this.el = null;
    
    this.lastUpdate = 0;
    this.dt = 0;
    this.timeDialation = 1;
    this.isReady = false;
    this.layers = {};
    
    this.autoGoToMap = false;
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
    
    this.configDir = '';

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
    
    this.ASSET_TYPE = {
      AUDIO: 0,
      IMAGE: 1,
      MAP: 2,
      PAGE: 3
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
    this.configDir = options.configDir;
    this.autoGoToMap = Boolean(options.autoGoToMap);
    
    utils.loadScripts(this.SCRIPTS, this.onScriptsLoaded.bind(this));
    
    // If we got the config dir as an argument, hook it up to load the game
    if (this.configDir) {
      this.on(this.EVENTS.READY, function onReadyToInit() {
        utils.request(this.getAssetPath('game.json'), this.createGameFromConfig.bind(this));
      }.bind(this));
    }
  };

  Game.prototype.getAssetPath = function getAssetPath(src, type) {
    var base = this.configDir + '/';
    
    if (type === this.ASSET_TYPE.IMAGE) {
      src = base + 'images/' + src;
    } else if (type === this.ASSET_TYPE.AUDIO) {
      src = base + 'audio/' + src;
    } else if (type === this.ASSET_TYPE.MAP) {
      src = base + 'maps/' + src + '.json';
    } else if (type === this.ASSET_TYPE.PAGE) {
      src = base + 'pages/' + src + '.html';
    } else {
      src = base + src;
    }
    
    return src;
  };
  
  Game.prototype.onScriptsLoaded = function onScriptsLoaded() {
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

    if (this.autoGoToMap) {
      this.goToFirstMap();
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
      tile.walkCost = tile.walkCost || 1;
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
  
  Game.prototype.goToFirstMap = function goToFirstMap() {
    var mapId = this.config.startingMap;
    var mapFromUrl = window.location.search.match(/map=([^\&]+)/i);
    
    if (mapFromUrl) {
      mapFromUrl = mapFromUrl[1];
    }
    
    if (this.config.maps.indexOf(mapFromUrl) !== -1) {
      mapId = mapFromUrl;
    }
    
    if (mapId) {
      this.goToMap(mapId);
    }
  };
  
  Game.prototype.goToMap = function goToMap(mapId) {
    var map = this.maps[mapId];
    
    // If map isn't loaded yet - load it and then come back here
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
    
    this.createDefaultLayers();

    for (var id in this.layers) {
      this.layers[id].setMap(map);
    }
    
    this.createPlayerActor();

    if (this.config.followPlayer) {
      this.camera.setActorToFollow(this.playerController.controlledActor);
    }
    
    this.navMesh.update();

    this.onResize();
    
    this.dispatch(this.EVENTS.MAP_CREATE, this);
    
    this.playerController.enable();
    
    window.requestAnimationFrame(this.runStartupScript.bind(this, 0));
    
    console.info('Finished loading map', this.currentMap);
  };
  
  Game.prototype.createPlayerActor = function createPlayerActor() {
    var playerActorData = this.config.playerActor;
    playerActorData.tile = this.currentMap.playerTile;
    var playerActor = this.layers.actors.addActor(playerActorData);
    this.playerController.setControlledActor(playerActor);
  };
  
  Game.prototype.runStartupScript = function runStartupScript(step) {
    var script = (this.currentMap.startScript || [])[step];
    
    if (!script) {
      console.info('Finished running startup script');
      return;
    }
    
    if (script.action === 'move') {
      var actor = this.getActor(script.actorId);
      var target = script.target;
      
      if (!actor) {
        console.warn('Actor not found for startup script', script);
        return;
      }
      if (!target) {
        console.warn('Target not found for startup script', script);
        return;
      }
      
      actor.moveTo(target);
    }
    
    this.runStartupScript(step + 1);
  };
  
  Game.prototype.createDefaultLayers = function createDefaultLayers() {
    var layers = this.layers;
    
    if (!layers.background) {
      layers.background = new TilesetLayer({
        'id': 'background',
        'game': this
      });
    }
    
    if (!layers.actors) {
      layers.actors = new Layer({
        'id': 'actors',
        'game': this
      });
    }
    
    if (!layers.hud) {
      layers.hud = new HUDLayer({
        'id': 'hud',
        'game': this
      });
    }
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
    for (var id in layers) {
      layers[id].clear();
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
    // If an actor - use its position
    if (position.position) {
      position = position.position;
    }
    
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
  
  Game.prototype.getScreenPosition = function getScreenPosition(position) {
    
    var bounds = this.el.getBoundingClientRect();
    
    return {
      'x': position.x + this.offset.x - bounds.left,
      'y': position.y + this.offset.y - bounds.top
    };
  };
  
  Game.prototype.getPositionFromScreen = function getPositionFromScreen(position) {
    return {
      'x': position.x - this.offset.x,
      'y': position.y - this.offset.y
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
    console.warn('SHOULD NOT USE DRAW TEXT', arguments);
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
    
    utils.request(this.getAssetPath(mapId, this.ASSET_TYPE.MAP), function onMapLoaded(mapData) {
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
      this.width = Math.min(this.currentMap.width, this.containerWidth);
      this.height = Math.min(this.currentMap.height, this.containerHeigh);
    } else {
      this.width = elParent.offsetWidth;
      this.height = elParent.offsetHeight;
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
    console.log('Map: ', this.mapWidth, ',', this.mapHeight);
    
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