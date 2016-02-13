/* global utils */
/* global Game */
/* global EventDispatcher */
/* global InputManager */

"use strict";

function init() {
  window.editor = new Editor();
}

var HTML_GAME_PANE = '<div class="editor-debug-flags">' +
                        '<input type="checkbox" id="config-debug" name="config-debug" checked title="Toggle Game Debug" />' +
                        '<input type="checkbox" id="config-debug-navmesh" name="config-debug-navmesh" title="Toggle Navigation Mesh Debug" />' +
                      '</div>' +
                      '<div class="editor-title">Game Settings</div>';
                      
var HTML_MAP_PANE  =  '<div class="editor-title">Map Config</div>';


function Editor(options) {
  this.elContainer = null;
  this.elDebug = null;
  this.game = null;
  
  this.gamePane = null;
  this.mapPane = null;
  this.tilesEditor = null;
  
  this.config = {
    game: null,
    map: null
  };
  
  this.settings = {
    'gamePane': {
      'width': 15
    },
    'mapPane': {
      'width': 15
    }
  };
  
  this.gameId = 'game';

  this.init(options);
}

Editor.prototype = Object.create(EventDispatcher.prototype);
Editor.prototype.constructor = Editor;

Editor.prototype.init = function init(options) {
  console.info('[Editor] init');
  
  !options && (options = {});
  
  this.elContainer = options.elContainer || document.body;
  this.elGamePane = this.elContainer.querySelector('.details-pane');
  this.elMapPane = this.elContainer.querySelector('.map-pane');

  this.elDebug = this.elContainer.querySelector('.editor-debug-flags');
  this.elDebug.addEventListener('change', this.onDebugChange.bind(this));
  
  this.elPlayable = this.elContainer.querySelector('input#is-playable');
  
  this.elContainer.querySelector('.export-config').addEventListener('click', this.getData.bind(this));
  
  this.elContainer.addEventListener('mousedown', this.onMouseDown.bind(this));
  this.elContainer.addEventListener('mousemove', this.onMouseMove.bind(this));
  window.addEventListener('keyup', this.onKeyUp.bind(this));
  
  this.applyUserSettings();
  Tooltip.init({
    'editor': this
  });

  utils.request('/data/schema.json', this.onGotSchema.bind(this));
};

Editor.prototype.onGotSchema = function onGotSchema(schema) {
  this.schema = schema;
  
  // Game info details pane
  this.paneGame = new Pane({
    'id': 'game',
    'el': this.elGamePane,
    'schema': this.schema.game,
    'onChange': this.onGameConfigChange.bind(this)
  });
  
  // Map info details pane
  this.paneMap = new Pane({
    'id': 'map',
    'el': this.elMapPane,
    'schema': this.schema.map,
    'onChange': this.onMapConfigChange.bind(this)
  });
  
  // Tiles editor
  this.tilesEditor = new Tiles({
    'editor': this,
    'elContainer': this.elGamePane,
    'onChange': this.onTilesChange.bind(this)
  });
  
  this.actorsEditor = new Actors({
    'editor': this,
    'elContainer': this.elMapPane,
    'onChange': this.onActorsChange.bind(this)
  });
  /*
  TextureEditor.init({
    'editor': this
  });
  */

  this.loadGame();
};

Editor.prototype.applyUserSettings = function applyUserSettings() {
  var settings = localStorage.editorSettings;
  if (settings) {
    try {
      settings = JSON.parse(settings);
    } catch (ex) {
      
    }
  }
  
  if (!settings) {
    settings = this.settings;
  }
  
  this.settings = settings;
  
  this.elGamePane.style.width = settings.gamePane.width + '%';
  this.elMapPane.style.width = settings.mapPane.width + '%';
};

Editor.prototype.saveUserSettings = function saveUserSettings() {
  localStorage.editorSettings = JSON.stringify(this.settings);
};

Editor.prototype.onMouseDown = function onMouseDown(e) {
  this.resizePanels(e);
};

Editor.prototype.onMouseMove = function onMouseMove(e) {
  if (InputManager.KEYS_DOWN[InputManager.KEYS.SHIFT]) {
    return;
  }
  
  if (this.heldActor) {
    var position = {
      'x': e.pageX,
      'y': e.pageY
    };
    
    position = this.game.getPositionFromScreen(position);
    position.x = utils.clamp(position.x, 0, this.game.mapWidth);
    position.y = utils.clamp(position.y, 0, this.game.mapHeight);
    
    this.heldActor.updatePosition(position);
  }
};

Editor.prototype.resizePanels = function resizePanels(e) {
  var self = this;
  var el = e.target;
  var toResize = el.dataset.resize;
  
  if (!toResize) {
    return;
  }
  
  var settings = this.settings[toResize === 'game'? 'gamePane' : 'mapPane'];
  var elPane = toResize === 'game'? this.elGamePane : this.elMapPane;
  
  function onMouseMove(e) {
    var width = (e.pageX / window.innerWidth * 100);
    
    e.preventDefault();
    
    if (elPane.classList.contains('right')) {
      width = (100 - width);
    }
    
    elPane.style.width = width + '%';
    settings.width = width;
    
    window.dispatchEvent(new Event('resize'));
  }
  
  function onMouseUp(e) {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    
    el.parentNode.classList.remove('resizing');
    self.saveUserSettings();
  }
  
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  
  el.parentNode.classList.add('resizing');
};

Editor.prototype.onKeyUp = function onKeyUp(e) {
  if (e.keyCode === InputManager.KEYS.DELETE) {
    if (this.heldActor) {
      var shouldDelete = confirm('Are you sure you want to delete "' + this.heldActor.id + '"?');
      if (shouldDelete) {
        this.actorsEditor.removeActor(this.heldActor);
        this.heldActor = null;
      }
    }
  }
};

Editor.prototype.loadGame = function loadGame() {
  var gameConfig = this.config.game;
  
  if (gameConfig) {
    gameConfig = JSON.parse(JSON.stringify(gameConfig));
    
    this.paneGame.updateFromJSON(gameConfig);
    
    this.refreshGame(true);
  } else {
    utils.request('/api/game/' + this.gameId, function onGotGame(gameConfig) {
      this.config.game = gameConfig;
      this.loadGame();
    }.bind(this));
  }
};

Editor.prototype.loadGameMap = function loadGameMap(mapId, callback) {
  var mapConfig = this.config.map;
  
  if (mapConfig) {
    mapConfig = JSON.parse(JSON.stringify(mapConfig));
    
    this.paneMap.updateFromJSON(mapConfig);
    this.actorsEditor.loadFromGame(mapConfig);
    
    this.game.addMap(mapConfig);
    callback && callback(mapConfig);
    
    this.game.playerController.disable();
  } else {
    utils.request('/api/game/' + this.gameId + '/map/' + mapId, function onGotMap(mapConfig) {
      this.config.map = mapConfig;
      this.loadGameMap(mapId, callback);
    }.bind(this));
  }
};

Editor.prototype.getData = function getData() {
  var w = window.open('__blank', 'about:blank', '');
  w.document.write('<body>' +
                      '<style>' +
                        '* { padding: 0; margin: 0; }' +
                        'body { background: #eee; margin: 0; padding: 0; }' +
                        'h1 { padding: 5px 10px; cursor: pointer; }' +
                        'h1:hover { background: rgba(0, 0, 0, .2); }' +
                        '.pane { width: 50%; float: left; }' +
                        '.json { padding: 5px; border: 1px solid #000; background: #fff; }' +
                      '</style>' +
                      '<script>' +
                        'function selectJSON(el) {' +
                          'window.getSelection().removeAllRanges();' +
                          'var range = document.createRange();' +
                          'range.selectNode(el);' +
                          'window.getSelection().addRange(range);' +
                        '}' +
                      '</script>' +
                      '<div class="pane">' +
                        '<h1 onclick="selectJSON(this.nextSibling);">Game</h1>' +
                        '<pre class="json">' + JSON.stringify(this.config.game, null, 2) + '</pre>' +
                      '</div>' +
                      '<div class="pane">' +
                        '<h1 onclick="selectJSON(this.nextSibling);">Map</h1>' +
                        '<pre class="json">' + JSON.stringify(this.config.map, null, 2) + '</pre>' +
                      '</div>' +
                    '</body>');
  /*
  console.group('JSON');
  console.log("Game:\n" + JSON.stringify(this.config.game));
  console.log("Map:\n" + JSON.stringify(this.config.map));
  console.groupEnd();
  */
};

Editor.prototype.refreshMap = function refreshMap() {
  console.warn('Refresh map');
  
  utils.post('/api/game/' + this.gameId + '/map/' + this.config.map.id, JSON.stringify(this.config.map));
  
  delete this.game.maps[this.config.map.id];
  this.game.goToMap(this.config.map.id);
};

Editor.prototype.refreshGame = function refreshGame(isFromLoad) {
  console.info('Refresh game');
  
  if (!isFromLoad) {
    this.saveGameConfig();
  }
  
  if (this.game) {
    this.game.destroy();
  }
  
  this.game = new Game({
    'el': document.getElementById('game'),
    'debug': this.elGamePane.querySelector('#config-debug').checked,
    'debugNavmesh': this.elGamePane.querySelector('#config-debug-navmesh').checked
  });
  
  this.game.configDir = '/' + this.gameId;
  
  this.game.loadMap = this.loadGameMap.bind(this);
  
  this.game.on(this.game.EVENTS.READY, this.onGameReady.bind(this));
  this.game.on(this.game.EVENTS.POINTER_TILE_CHANGE, this.onGamePointerTileChange.bind(this));
  this.game.on(this.game.EVENTS.CLICK, function onGameClick(data) {
    this.handleGameClick(data, true);
  }.bind(this));
  this.game.on(this.game.EVENTS.CLICK_SECONDARY, function onGameClickSecondary(data) {
    this.handleGameClick(data, false);
  }.bind(this));
};

Editor.prototype.onGameReady = function onGameReady() {
  this.tilesEditor.loadFromGame(this.config.game);
  this.game.createGameFromConfig(this.config.game);
  
  this.game.camera.setActorToFollow(null);
};

Editor.prototype.resizeGridByClick = function resizeGridByClick(data, isLeftButton) {
  var grid = this.config.map.grid;
  var clickedTileX = data.tile.x;
  var clickedTileY = data.tile.y;
  var didResizeGrid = false;
  var adding = isLeftButton;
  var actorsOffset = {
    'x': 0,
    'y': 0
  };
  var MIN_SIZE = 3;
  
  if (adding || grid[0].length > MIN_SIZE) {
    if (clickedTileX === 0) {
      for (var i = 0; i < grid.length; i++) {
        if (adding) {
          grid[i].splice(0, 0, '');
        } else {
          grid[i].splice(0, 1);
        }
      }
      actorsOffset.x = adding? 1 : -1;
      didResizeGrid = true;
    } else if (clickedTileX === grid[0].length - 1) {
      for (var i = 0; i < grid.length; i++) {
        if (adding) {
          grid[i].push('');
        } else {
          grid[i].splice(grid[i].length - 1, 1);
        }
      }
      didResizeGrid = true;
    }
  }
  
  if (adding || grid.length > MIN_SIZE) {
    if (clickedTileY === 0) {
      if (adding) {
        var row = [];
        for (var i = 0; i < grid[0].length; i++) {
          row.push('');
        }
        grid.splice(0, 0, row);
        actorsOffset.y = 1;
      } else {
        grid.splice(0, 1);
        actorsOffset.y = -1;
      }
      
      didResizeGrid = true;
    } else if (clickedTileY === grid.length - 1) {
      if (adding) {
        var row = [];
        for (var i = 0; i < grid[0].length; i++) {
          row.push('');
        }
        grid.push(row);
      } else {
        grid.splice(grid.length - 1, 1);
      }
      didResizeGrid = true;
    }
  }
  

  if (didResizeGrid) {
    var actors = this.config.map.actors;
    
    for (var i = 0, len = actors.length; i < len; i++) {
      actors[i].tile.x += actorsOffset.x;
      actors[i].tile.y += actorsOffset.y;
      
      if (actors[i].tile.y < 0 || actors[i].tile.y > grid.length - 1) {
        actors[i].tile.y = Math.floor(grid.length / 2);
      }
      if (actors[i].tile.x < 0 || actors[i].tile.x > grid[0].length - 1) {
        actors[i].tile.x = Math.floor(grid[0].length / 2);
      }
    }
  }
  
  return didResizeGrid;
};

Editor.prototype.pickupActor = function pickupActor(actor) {
  var heldActorId = '';
  
  if (this.heldActor) {
    heldActorId = this.heldActor.id;
    this.dropHeldActor();
  }
  
  if (typeof actor === 'string') {
    actor = this.game.getActor(actor);
  }
  
  if (!actor) {
    return;
  }
  
  if (heldActorId === actor.id) {
    this.dropHeldActor();
  } else {
    this.heldActor = actor;
    
    this.actorsEditor.highlight(this.heldActor);
    this.heldActor.setAlpha(0.5);
  }
};

Editor.prototype.dropHeldActor = function dropHeldActor() {
  if (!this.heldActor) {
    return;
  }

  this.placeActor(this.heldActor);
  
  this.actorsEditor.removeHighlight();
};

Editor.prototype.handleGameClick = function handleGameClick(data, isLeftButton) {
  var didChangeMap = false;
  
  // Place or pick up actors to move around
  if (this.heldActor) {
    this.dropHeldActor();
  } else {
    var actorOnTile = data.actors[Object.keys(data.actors)[0]];
    if (actorOnTile) {
      this.actorsEditor.highlight(actorOnTile);
      
      if (!isLeftButton) {
        this.pickupActor(actorOnTile);
      }
    } else {
      this.actorsEditor.removeHighlight();
    }
  }
  
  // If nothing else happened - check for resizing the grid
  var didResizeGrid = false;
  if (!this.heldActor) {
    didResizeGrid = this.resizeGridByClick(data, isLeftButton);
    if (didResizeGrid) {
      didChangeMap = true;
    }
  }

  // Change tiles
  if (!didResizeGrid) {
    if (this.tilesEditor.placingTile) {
      var tileToPlace = isLeftButton? this.tilesEditor.placingTile.id : '';
      this.config.map.grid[data.tile.y][data.tile.x] = tileToPlace;
      didChangeMap = true;
    }
  }
  
  if (didChangeMap) {
    this.refreshMap();
  }
};

Editor.prototype.onGamePointerTileChange = function onGamePointerTileChange(data) {
  if (this.heldActor && InputManager.KEYS_DOWN[InputManager.KEYS.SHIFT]) {
    this.heldActor.updateTile(data.tile);
  }
};

Editor.prototype.placeActor = function placeActor(actor) {
  var tile = null;
  var position = null;
  
  if (InputManager.KEYS_DOWN[InputManager.KEYS.SHIFT]) {
    //this.heldActor.updateTile(tile);
    tile = this.heldActor.tile;
  } else {
    position = this.heldActor.position;
  }
  
  this.heldActor.setAlpha();
  this.heldActor = null;

  var actors = this.config.map.actors;
  for (var i = 0, len = actors.length; i < len; i++) {
    if (actors[i].id === actor.id) {
      if (tile) {
        actors[i].tile = tile;
        delete actors[i].position;
      } else {
        actors[i].position = position;
        delete actors[i].tile;
      }
      
      break;
    }
  }
  
  this.refreshMap();
};


// Change events
Editor.prototype.onGameConfigChange = function onGameConfigChange() {
  this.paneGame.updateJSON(this.config.game);
  this.refreshGame();
};

Editor.prototype.onTilesChange = function onTilesChange(tiles) {
  for (var i = 0, len = tiles.length; i < len; i++) {
    delete tiles[i].texture.game;
  }
  
  this.config.game.tiles = tiles;
  this.game.setTiles(tiles);
  
  this.saveGameConfig();
};

Editor.prototype.onMapConfigChange = function onMapConfigChange(e) {
  this.paneMap.updateJSON(this.config.map);
  this.refreshMap();
};

Editor.prototype.onActorsChange = function onActorsChange(actors) {
  this.config.map.actors = actors;
  this.refreshMap();
};

Editor.prototype.onDebugChange = function onDebugChange(e) {
  var el = e.target;
  var state = el.checked;
  
  if (el.id === 'config-debug') {
    this.game.setDebug(state);
  } else if (el.id === 'config-debug-navmesh') {
    this.game.setDebugNavmesh(state);
  }
};

Editor.prototype.saveGameConfig = function saveGameConfig() {
  utils.post('/api/game/' + this.gameId, JSON.stringify(this.config.game));
};

var Tooltip = (function Tooltip() {
  function Tooltip() {
    this.el = null;
    this.editor = null;
  }
  
  Tooltip.prototype.TYPES = {
    ACTOR: 'actor',
    TILE: 'tile'
  };

  Tooltip.prototype.init = function init(options) {
    this.editor = options.editor;
    
    this.createHTML();
    
    document.body.addEventListener('mousemove', this.onMouseMove.bind(this));
  };
  
  Tooltip.prototype.onMouseMove = function onMouseMove(e) {
    var el = e.target;
    var dataset = el.dataset || {};
    var type = dataset.tooltipType;
    
    if (type) {
      var id = dataset.tooltipId;
      var data = this['getData_' + type](id);
      var schema = this.editor.schema[type];
      var bounds = el.getBoundingClientRect();
      
      if (!data) {
        console.warn('No data to display tooltip', type, id, data, schema);
        return;
      }
      if (!schema) {
        console.warn('No schema to display tooltip', type, id, data, schema);
        return;
      }
      
      var x = bounds.left + bounds.width / 2;
      var y = bounds.top + bounds.height / 2;
      this.el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      
      this.createTooltip(type, id, schema, data);
    } else if (!utils.inParent(el, '.edit-tooltip')) {
      this.hide();
    }
  };
  
  Tooltip.prototype.createTooltip = function createTooltip(type, id, schema, data) {
    if (this.pane && this.pane.id === id) {
      return;
    }
    
    this.elPane.innerHTML = '';
    
    this.pane = new Pane({
      'id': id,
      'el': this.elPane,
      'schema': schema,
      'onChange': function onDataChange() {
        var json = {};
        this.pane.updateJSON(json);
        this['change_' + type](id, json);
      }.bind(this)
    });
    this.pane.updateFromJSON(data);
    
    this.el.classList.add('visible');
  };
  
  Tooltip.prototype.hide = function hide() {
    this.pane = null;
    this.elPane.innerHTML = '';
    this.el.classList.remove('visible');
  };
  
  Tooltip.prototype.getData_tile = function getData_tile(id) {
    return this.editor.tilesEditor.getTooltipData(id);
  };
  
  Tooltip.prototype.change_tile = function change_tile(id, data) {
    return this.editor.tilesEditor.updateTile(id, data);
  };
  
  Tooltip.prototype.getData_actor = function getData_actor(id) {
    return this.editor.actorsEditor.getTooltipData(id);
  };
  
  Tooltip.prototype.change_actor = function change_actor(id, data) {
    return this.editor.actorsEditor.updateActor(id, data);
  };
  
  Tooltip.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    this.el.className = 'edit-tooltip';
    
    this.el.innerHTML = '<div class="pane"></div>';
    
    this.elPane = this.el.querySelector('.pane');
    
    document.body.appendChild(this.el);
  };
  
  return new Tooltip();
}());


var Actors = (function Actors() {
  var TEMPLATE_ACTORS = '<div class="editor-title">' +
                          'Actors' +
                          '<div class="editor-button create-new">New Actor</div>' +
                        '</div>' +
                        '<input type="checkbox" checked class="expand-collapse"></div>' +
                        '<div class="actors-list collapsible"></div>';
                        
  var TEMPLATE_ACTOR = '<div class="main-info">' +
                          '<div class="input input-text input-id">' +
                            '<div class="pane-input-label">' +
                              '<label for="actor_id[{{id}}]">Id</label>' +
                            '</div>' +
                            '<div class="pane-input-field">' +
                              '<input type="text" readonly data-property="id" data-id="{{id}}" title="Actor\'s ID" id="actor_id[{{id}}]" value="{{id}}" />' +
                            '</div>' +
                          '</div>' +
                          '<div class="input input-text input-tooltip">' +
                            '<div class="pane-input-label">' +
                              '<label for="actor_tooltip[{{id}}]">Tooltip</label>' +
                            '</div>' +
                            '<div class="pane-input-field">' +
                              '<input type="text" data-property="tooltip" data-id="{{id}}" title="Actor\'s Tooltip" id="actor_tooltip[{{id}}]" value="{{tooltip}}" />' +
                            '</div>' +
                          '</div>' +
                        '</div>' +
                        '<div class="editor-button move-actor" data-id="{{id}}" title="Move Actor">&lt;</div>' +
                        '<div class="actor-modules"></div>';
  
  function Actors(options) {
    this.elContainer = null;
    this.el = null;
    
    this.editor = null;
    this.onChange = null;
    
    this.actors = [];
    this.textures = {};
    this.modules = {};
    
    this.init(options);
  }
  
  Actors.prototype.init = function init(options) {
    this.editor = options.editor;
    this.elContainer = options.elContainer;
    this.onChange = options.onChange;
    
    this.createHTML();
    
    this.el.addEventListener('click', this.onClick.bind(this));
    this.el.querySelector('.create-new').addEventListener('click', this.createNew.bind(this));
  };
  
  Actors.prototype.highlight = function highlight(actor) {
    this.removeHighlight();
    
    var el = this.getActorEl(actor);
    if (el) {
      el.classList.add('highlight');
      
      var top = el.offsetTop;
      
      if (top < this.elList.scrollTop ||
          top > this.elList.scrollTop + this.elList.offsetHeight) {
        this.elList.scrollTop = top - 10;
        
      } else {
      }
    }
  };
  
  Actors.prototype.removeHighlight = function removeHighlight() {
    var el = this.elList.querySelector('.actor.highlight');
    if (el) {
      el.classList.remove('highlight');
    }
  };
  
  Actors.prototype.addActor = function addActor(actor) {
    var el = document.createElement('div');
    
    actor = JSON.parse(JSON.stringify(actor));
    
    if (!actor.tooltip) {
      actor.tooltip = '';
    }
    
    this.actors.push(actor);
    
    el.className = 'actor';
    el.dataset.id = actor.id;
    
    el.innerHTML = TEMPLATE_ACTOR.format(actor);
    
    el.querySelector('.main-info').addEventListener('change', this.onActorsChange.bind(this));
    
    this.createActorModules(actor, el);

    this.elList.appendChild(el);
  };
  
  Actors.prototype.removeActor = function removeActor(actor) {
    var didFindActor = false;
    var actors = this.actors;
    
    for (var i = 0, len = actors.length; i < len; i++) {
      if (actors[i].id === actor.id) {
        actors.splice(i, 1);
        didFindActor = true;
        break;
      }
    }
    
    if (didFindActor) {
      var el = this.getActorEl(actor);
      if (el) {
        el.parentNode.removeChild(el);
      }
      
      this.onChange(this.actors);
    }
  };
  
  Actors.prototype.createActorModules = function createActorModules(actor, el) {
    var elModules = el.querySelector('.actor-modules');
    var modules = actor.modules || [];
    
    this.modules[actor.id] = [];
    
    for (var i = 0, len = modules.length; i < len; i++) {
      var actorModule = new EditorActorModule({
        'index': i,
        'actor': actor,
        'data': modules[i],
        'onChange': this.onActorModuleChange.bind(this)
      });
      
      this.modules[actor.id].push(actorModule);
      
      elModules.appendChild(actorModule.el);
    }

    var elTexture = el.querySelector('.texture canvas');
    if (elTexture) {
      elTexture.dataset.tooltipId = actor.id;
      elTexture.dataset.tooltipType = Tooltip.TYPES.ACTOR;
    }
  };
  
  Actors.prototype.onActorModuleChange = function onActorModuleChange(actor, index, data) {
    actor.modules[index] = data;
    
    this.onChange(this.actors);
  };
  
  Actors.prototype.onTextureChange = function onTextureChange(id) {
    var actor = this.getActor(id);
    var texture = this.textures[id];
    
    actor.texture = JSON.parse(JSON.stringify(texture.data));
    
    this.onChange(this.actorss);
  };
  
  Actors.prototype.updateActor = function updateActor(id, data) {
    var actor = this.getActor(id);
    if (actor) {
      for (var k in data) {
        if (actor.hasOwnProperty(k)) {
          actor[k] = data[k];
        }
      }
      
      this.onChange(this.actors);
    }
  };
  
  Actors.prototype.getTooltipData = function getTooltipData(id) {
    var actor = this.getActor(id);
    var data = null;
    
    if (actor) {
      data = {
        'isBlocking': actor.isBlocking,
        'zIndex': actor.zIndex
      };
    }
    
    return data;
  };
  
  Actors.prototype.createNew = function createNew() {
    var actor = {
      'id': 'actor_' + utils.randomId(),
      'modules': [
        utils.getSchemaDefault(this.editor.schema.texture, {
          'type': 'ModuleTexture'
        })
      ]
    };

    this.addActor(actor);
    
    this.onChange(this.actors);
    
    this.elList.scrollTop = 999999;
  };
  
  Actors.prototype.loadFromGame = function loadFromGame(mapConfig) {
    if (this.actors.length > 0) {
      return;
    }
    
    var actors = mapConfig.actors;
    
    for (var i = 0, len = actors.length; i < len; i++) {
      this.addActor(actors[i]);
    }
  };

  Actors.prototype.onClick = function onClick(e) {
    var el = e.target;
    if (el.classList.contains('move-actor')) {
      this.editor.pickupActor(el.dataset.id);
    }
  };
  
  Actors.prototype.onActorsChange = function onActorsChange(e) {
    e && e.stopPropagation();
    
    var elChanged = e.target;
    var id = elChanged.dataset.id;
    var actor = this.getActor(id);
    if (!actor) {
      return;
    }
    
    var elActor = this.getActorEl(actor);
    if (!elActor) {
      return;
    }
    
    var elTooltip = elActor.querySelector('[data-property = "tooltip"]');
    
    actor.tooltip = elTooltip.value || '';

    this.onChange(this.actors);
  };
  
  Actors.prototype.getActor = function getActor(id) {
    var actor = null;
    
    for (var i = 0, len = this.actors.length; i < len; i++) {
      if (this.actors[i].id === id) {
        actor = this.actors[i];
        break;
      }
    }
    
    return actor;
  };
  
  Actors.prototype.getActorEl = function getActorEl(actor) {
    return this.el.querySelector('.actor[data-id = "' + actor.id + '"]');
  };
  
  Actors.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    this.el.className = 'actors-editor';
    this.el.innerHTML = TEMPLATE_ACTORS;
    
    this.elList = this.el.querySelector('.actors-list');
    
    this.elContainer.appendChild(this.el);
  };
  
  return Actors;
}());

var EditorActorModule = (function EditorActorModule() {
  function EditorActorModule(options) {
    this.index = -1;
    this.el = null;
    this.data = null;
    this.onChange = null;
    
    this.pane = null;
    this.texture = null;
    
    this.init(options);
  }
  
  EditorActorModule.prototype.init = function init(options) {
    this.index = options.index;
    this.actor = options.actor;
    this.data = JSON.parse(JSON.stringify(options.data));
    this.onChange = options.onChange || function(){};
    
    this.createHTML();
  };
  
  EditorActorModule.prototype.onPaneChange = function onPaneChange() {
    var valueData = {};
    valueData[this.data.type] = this.data;
    this.pane.updateJSON(valueData);
    this.data = valueData[this.data.type];
    
    this.reportChange();
  };
  
  EditorActorModule.prototype.onTextureChange = function onTextureChange() {
    console.warn('texture change');
    
    delete this.texture.data.game;
    var data = JSON.parse(JSON.stringify(this.texture.data));
    data.type = this.data.type;
    this.data = data;
    
    this.reportChange();
  };
  
  EditorActorModule.prototype.reportChange = function reportChange() {
    this.onChange(this.actor, this.index, this.data);
  };
  
  EditorActorModule.prototype.createHTML = function createHTML() {
    var type = this.data.type;
    
    this.el = document.createElement('div');
    this.el.className = 'actor-module ' + type;

    if (type === 'ModuleTexture') {
      this.texture = new EditorTexture({
        'elContainer': this.el,
        'data': this.data,
        'onChange': this.onTextureChange.bind(this)
      });      
    } else {
      var schema = editor.schema.actorModules[type];
      if (schema) {
        var schemaData = {};
        var valueData = {};
        schemaData[type] = schema;
        valueData[type] = this.data;
        
        this.pane = new Pane({
          'id': this.actor.id + '_' + type,
          'el': this.el,
          'schema': schemaData,
          'onChange': this.onPaneChange.bind(this)
        });
        this.pane.updateFromJSON(valueData);
        
        var elToggler = this.pane.el.querySelector('input[type = "checkbox"]');
        if (elToggler) {
          elToggler.checked = false;
        }
      }
    }
  };
  
  return EditorActorModule;
}());

var Tiles = (function Tiles() {
  var TEMPLATE_TILES = '<div class="editor-title">' +
                          'Tiles' +
                          '<div class="editor-button create-new">+</div>' +
                        '</div>' +
                        '<input type="checkbox" checked class="expand-collapse"></div>' +
                        '<div class="tiles-list collapsible"></div>';
                        
  var TEMPLATE_TILE = '<div class="texture-container"></div>' +
                      '<b class="editor-button place-tile" data-index="{{index}}" title="Place Tile">&gt;</b>';
  
  function Tiles(options) {
    this.elContainer = null;
    this.el = null;
    
    this.editor = null;
    this.onChange = null;
    this.placingTile = null;
    
    this.tiles = [];
    this.tilesTextures = [];
    
    this.init(options);
  }
  
  Tiles.prototype.init = function init(options) {
    this.editor = options.editor;
    this.elContainer = options.elContainer;
    this.onChange = options.onChange;
    
    this.createHTML();
    
    this.el.addEventListener('click', this.onClick.bind(this));
    this.el.querySelector('.create-new').addEventListener('click', this.createNew.bind(this));
  };
  
  Tiles.prototype.addTile = function addTile(tile) {
    var el = document.createElement('div');
    
    tile = JSON.parse(JSON.stringify(tile));
    
    tile.index = this.tiles.length;
    this.tiles.push(tile);
    
    el.className = 'tile';
    el.dataset.index = tile.index;
    el.dataset.id = tile.id;
    el.dataset.placing = false;

    el.innerHTML = TEMPLATE_TILE.format(tile);
    
    tile.texture.width = this.editor.config.game.tileSize;
    tile.texture.height = this.editor.config.game.tileSize;
    tile.texture.origin = {
      'x': 0,
      'y': 0
    };
    
    this.tilesTextures[tile.index] = new EditorTexture({
      'elContainer': el.querySelector('.texture-container'),
      'data': tile.texture,
      'onChange': this.onTextureChange.bind(this, tile.index)
    });
    
    el.querySelector('.texture-container canvas').dataset.tooltipId = tile.id;
    el.querySelector('.texture-container canvas').dataset.tooltipType = Tooltip.TYPES.TILE;

    this.elList.appendChild(el);
  };
  
  Tiles.prototype.getTooltipData = function getTooltipData(tileId) {
    var tile = this.getTile(tileId);
    var data = null;
    
    if (tile) {
      data = {
        'isBlocking': tile.isBlocking,
        'walkCost': tile.walkCost
      };
    }
    
    return data;
  };
  
  Tiles.prototype.updateTile = function updateTile(tileId, data) {
    var tile = this.getTile(tileId);
    if (tile) {
      for (var k in data) {
        tile[k] = data[k];
      }
      
      this.onChange(this.tiles);
    }
  };
  
  Tiles.prototype.onTextureChange = function onTextureChange(tileIndex) {
    var tile = this.tiles[tileIndex];
    var texture = this.tilesTextures[tileIndex];
    var data = texture.data;
    
    delete data.game;
    tile.texture = JSON.parse(JSON.stringify(data));
    
    this.onChange(this.tiles);
  };
  
  Tiles.prototype.createNew = function createNew() {
    var textureToDuplicate = this.tiles[this.tiles.length - 1].texture;
    delete textureToDuplicate.game;
    
    var tile = {
      'id': 'default_' + Date.now(),
      'isBlocking': false,
      'walkCost': 1,
      'texture': JSON.parse(JSON.stringify(textureToDuplicate)),
    };

    this.addTile(tile);
    
    this.onChange(this.tiles);
    
    this.elList.scrollTop = 999999;
  };
  
  Tiles.prototype.loadFromGame = function loadFromGame(gameConfig) {
    this.tiles = [];
    this.tilesTextures = [];
    this.elList.innerHTML = '';
    
    for (var i = 0, len = gameConfig.tiles.length; i < len; i++) {
      this.addTile(gameConfig.tiles[i]);
    }
  };

  Tiles.prototype.onClick = function onClick(e) {
    var elClicked = e.target;
    if (elClicked.classList.contains('place-tile')) {
      var tile = this.tiles[elClicked.dataset.index * 1];
      if (tile) {
        if (this.placingTile) {
          var elPrevious = this.getTileEl(this.placingTile);
          if (elPrevious) {
            elPrevious.dataset.placing = false;
          }
        }
        
        if (this.placingTile && this.placingTile.index === tile.index) {
          this.placingTile = null;
        } else {
          var elNew = this.getTileEl(tile);
          if (elNew) {
            elNew.dataset.placing = true;
          }
          
          this.placingTile = tile;
        }
      }
    }
  };

  Tiles.prototype.getTile = function getTile(tileId) {
    var tile = null;
    
    for (var i = 0, len = this.tiles.length; i < len; i++) {
      if (this.tiles[i].id === tileId) {
        tile = this.tiles[i];
        break;
      }
    }
    
    return tile;
  };
  
  Tiles.prototype.getTileEl = function getTileEl(tile) {
    return this.el.querySelector('.tile[data-index = "' + tile.index + '"]');
  };
  
  Tiles.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    this.el.className = 'tiles-editor';
    this.el.innerHTML = TEMPLATE_TILES;
    
    this.elList = this.el.querySelector('.tiles-list');
    
    this.elContainer.appendChild(this.el);
  };
  
  return Tiles;
}());

var EditorTexture = (function EditorTexture() {
  var TEMPLATE = '<canvas />';
  
  function EditorTexture(options) {
    this.elContainer = null;
    this.el = null;
    this.canvas = null;
    
    this.data = null;
    this.texture = null;
    
    this.onChange = null;
    
    this.size = 32;
    
    this.init(options);
  }
  
  EditorTexture.prototype.init = function init(options) {
    this.elContainer = options.elContainer;
    this.data = options.data;
    this.meta = options.meta || {};
    this.onChange = options.onChange || function(){};
    
    this.createHTML();
    
    this.data.game = editor.game;
    this.texture = new Texture(this.data);
    this.texture.on('load', this.drawTexture.bind(this));
  };
  
  EditorTexture.prototype.onClick = function onClick() {
    var w = window.open('texture.html', '__blank', 'width=800,height=600');
    w.addEventListener('load', function onTextureEditorWindowLoad() {
      w.show(editor, this.data, this.meta, this.onUpdateTexture.bind(this));
    }.bind(this));
    
    //TextureEditor.show(this.data, this.meta, this.onUpdateTexture.bind(this));
  };
  
  EditorTexture.prototype.onUpdateTexture = function onUpdateTexture(data) {
    this.data = data;
    
    this.texture.setData(data);
    this.drawTexture();
    
    this.onChange(this.data);
  };
  
  EditorTexture.prototype.drawTexture = function drawTexture() {
    this.canvas.width = this.texture.width;
    this.canvas.height = this.texture.height;
    
    this.texture.draw(this.canvas.getContext('2d'));
  };
  
  EditorTexture.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    this.el.className = 'texture';
    this.el.innerHTML = TEMPLATE.format(this.data);
    
    this.canvas = this.el.querySelector('canvas');
    this.canvas.addEventListener('click', this.onClick.bind(this));
    
    this.canvas.style.width = this.size + 'px';
    this.canvas.style.height = this.size + 'px';
    this.el.style.width = this.size + 'px';
    this.el.style.height = this.size + 'px';
    
    this.elContainer.appendChild(this.el);
  };

  return EditorTexture;
}());


// A template formatting method
// Replaces {{propertyName}} with properties from the 'args' object
// Supports {{object.property}}
// Use {{l10n(key-name)}} to automatically get from l10n object
String.prototype.REGEX_FORMAT = /(\{\{([^\}]+)\}\})/g;
String.prototype.format = function format(args, shouldSanitise) {
  !args && (args = {});

  return this.replace(String.prototype.REGEX_FORMAT, function onMatch() {
    var key = arguments[2];
    var properties = key.split('.');
    var value = args;
    
    // support nesting - "I AM {{ship.info.name}}"
    for (var i = 0, len = properties.length; i < len; i++) {
      var propertyName = properties[i];
      
      if (properties[i].indexOf('[') !== -1) {
        var index = propertyName.substring(propertyName.indexOf('[') + 1);
        index = index.substring(0, index.indexOf(']'));
        propertyName = propertyName.substring(0, propertyName.indexOf('['));
        
        value = value && value[propertyName][index];
      } else {
        value = value && value[propertyName];
      }
    }

    if (value === undefined || value === null) {
      value = arguments[0];
    }

    return value;
  });
};

init();