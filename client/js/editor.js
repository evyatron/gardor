/* global utils */
/* global Game */
/* global EventDispatcher */
/* global JSONForm */

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
  this.elPlayable.addEventListener('change', this.onPlayableChange.bind(this));
  
  this.elContainer.querySelector('.export-config').addEventListener('click', this.getData.bind(this));
  
  this.elContainer.addEventListener('mousedown', this.onMouseDown.bind(this));
  
  this.applyUserSettings();

  utils.request('/data/schema.json', this.onGotSchema.bind(this));
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
  var self = this;
  var el = e.target;
  var toResize = el.dataset.resize;
  var settings = this.settings[toResize === 'game'? 'gamePane' : 'mapPane'];
  var elPane = toResize === 'game'? this.elGamePane : this.elMapPane;
  
  function onMouseMove(e) {
    var x = e.pageX;
    var width = (x / window.innerWidth * 100);
    
    if (elPane.classList.contains('right')) {
      width = (100 - width);
    }
    
    elPane.style.width = width + '%';
    settings.width = width;
    window.dispatchEvent(new Event('resize'));
  }
  
  function onMouseUp(e) {
    self.elContainer.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    el.parentNode.classList.remove('resizing');
    self.saveUserSettings();
  }
  
  if (toResize) {
    this.elContainer.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.parentNode.classList.add('resizing');
  }
}

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

  this.loadGame();
};

Editor.prototype.loadGame = function loadGame(gameConfig) {
  if (!gameConfig) {
    utils.request('/data/game.json', this.loadGame.bind(this));
    return false;
  }
  
  this.config.game = gameConfig;
  this.paneGame.updateFromJSON(gameConfig);

  this.refreshGame();
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
  delete this.game.maps[this.config.map.id];
  this.paneMap.updateJSON(this.config.map);
  this.game.goToMap(this.config.map.id);
};

Editor.prototype.refreshGame = function refreshGame() {
  console.info('Refresh game');
  
  if (this.game) {
    this.game.destroy();
  }
  
  this.game = new Game({
    'el': document.getElementById('game'),
    'debug': this.elGamePane.querySelector('#config-debug').checked,
    'debugNavmesh': this.elGamePane.querySelector('#config-debug-navmesh').checked
  });
  
  this.game.loadMap = this.loadGameMap.bind(this);
  
  this.game.on(this.game.EVENTS.READY, this.onGameReady.bind(this));
  this.game.on(this.game.EVENTS.CLICK, this.onGameClick.bind(this));
  this.game.on(this.game.EVENTS.CLICK_SECONDARY, this.onGameClickSecondary.bind(this));
  this.game.on(this.game.EVENTS.POINTER_TILE_CHANGE, this.onGamePointerTileChange.bind(this));
  
};

Editor.prototype.onGameReady = function onGameReady() {
  var config = JSON.parse(JSON.stringify(this.config.game));
  
  this.paneGame.updateJSON(config);
  
  this.tilesEditor.loadFromGame(config);

  this.game.createGameFromConfig(config);
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

Editor.prototype.handleGameClick = function handleGameClick(data, isLeftButton) {
  if (this.isPlayable) {
    return;
  }
  
  var canResizeGrid = true;
  var shouldRefreshMap = false;
  
  // Place or pick up actors to move around
  if (this.heldActor) {
    canResizeGrid = false;
    this.placeActorOnTile(this.heldActor, data.tile);
    this.actorsEditor.removeHighlight();
  } else {
    var actorOnTile = data.actors[Object.keys(data.actors)[0]];
    if (actorOnTile) {
      canResizeGrid = false;
      this.actorsEditor.highlight(actorOnTile);
      
      if (!isLeftButton) {
        this.heldActor = actorOnTile;
        this.heldActor.setAlpha(0.5);
      }
    } else {
      this.actorsEditor.removeHighlight();
    }
  }
  
  // If nothing else happened - check for resizing the grid
  if (canResizeGrid) {
    var didResizeGrid = this.resizeGridByClick(data, isLeftButton);
    if (didResizeGrid) {
      shouldRefreshMap = true;
    }
  }

  // Change tiles
  if (this.tilesEditor.placingTile) {
    this.config.map.grid[data.tile.y][data.tile.x] = this.tilesEditor.placingTile.id;
    shouldRefreshMap = true;
  }
  
  // If we edited something - refresh!
  if (shouldRefreshMap) {
    this.refreshMap();
  }
};

Editor.prototype.onGameClick = function onGameClick(data) {
  this.handleGameClick(data, true);
};

Editor.prototype.onGameClickSecondary = function onGameClickSecondary(data) {
  this.handleGameClick(data, false);
};



Editor.prototype.onGamePointerTileChange = function onGamePointerTileChange(data) {
  if (this.heldActor) {
    this.heldActor.updateTile(data.tile);
  }
};

Editor.prototype.placeActorOnTile = function placeActorOnTile(actor, tile) {
  this.heldActor.updateTile(tile);
  this.heldActor.setAlpha();
  this.heldActor = null;
  
  
  var actors = this.config.map.actors;
  for (var i = 0, len = actors.length; i < len; i++) {
    if (actors[i].id === actor.id) {
      actors[i].tile = tile;
      break;
    }
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
    
    this.disablePlay();
  } else {
    this.getGameMapConfig(mapId, callback);
  }
};

Editor.prototype.getGameMapConfig = function getGameMapConfig(mapId, callback) {
  var url = '/data/' + mapId + '.json';
  
  utils.request(url, function onGotMap(mapConfig) {
    this.config.map = mapConfig;
    this.loadGameMap(mapId, callback);
  }.bind(this));
};

Editor.prototype.enablePlay = function enablePlay() {
  this.isPlayable = true;
  this.game.playerController.enable();
  this.elPlayable.checked = true;
  this.game.camera.setActorToFollow(this.game.playerController.controlledActor);
};

Editor.prototype.disablePlay = function disablePlay() {
  this.isPlayable = false;
  this.game.playerController.disable();
  this.elPlayable.checked = false;
  this.game.camera.setActorToFollow(null);
};


// Change events
Editor.prototype.onPlayableChange = function onPlayableChange() {
  if (this.elPlayable.checked) {
    this.enablePlay();
  } else {
    this.disablePlay();
  }
};

Editor.prototype.onGameConfigChange = function onGameConfigChange() {
  this.refreshGame();
};

Editor.prototype.onMapConfigChange = function onMapConfigChange(e) {
  this.refreshMap();
};

Editor.prototype.onTilesChange = function onTilesChange(tiles) {
  this.config.game.tiles = tiles;
  this.game.setTiles(tiles);
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






var Pane = (function Pane() {
  function Pane(options) {
    this.id = '';
    this.el = null;
    this.elInput = null;
    this.schema = {};
    this.flatSchema = {};
    this.value = {};
    
    this.inputs = {};
    
    this.EVENTS = {
      CHANGE: 'change',
      READY: 'ready'
    };
    
    this.init(options);
  }
  
  Pane.prototype = Object.create(EventDispatcher.prototype);
  Pane.prototype.constructor = Pane;
  
  Pane.prototype.init = function init(options) {
    this.id = options.id;
    this.el = options.el;
    
    this.el.addEventListener('click', this.onClick.bind(this));
    
    if (options.onReady) {
      this.on(this.EVENTS.READY, options.onReady);
    }
    if (options.onChange) {
      this.on(this.EVENTS.CHANGE, options.onChange);
    }
    
    this.setSchema(options.schema);
  };
  
  Pane.prototype.setSchema = function setSchema(schema) {
    console.log('[Editor][Pane|' + this.id + '] Set schema', schema);
    
    this.schema = schema;
    
    for (var propertyId in schema) {
      this.createItem(this.id + '_' + propertyId, schema[propertyId], this.el);
    }
    
    console.info('Pane ready', this.id, this);

    this.dispatch(this.EVENTS.READY, this);
  };
  
  Pane.prototype.updateJSON = function updateJSON(json) {
    for (var id in this.inputs) {
      var value = this.inputs[id].value;
      var cleanId = id.replace(this.id + '_', '').replace(/_/g, '.');
      
      if (typeof value === 'string') {
        value = '"' + value.replace(/"/g, '\\"') + '"';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      var expr = 'json.' + cleanId + ' = ' + value + ';';
      
      eval(expr);
    }
  };
  
  Pane.prototype.updateFromJSON = function updateFromJSON(json) {
    for (var id in this.inputs) {
      var cleanId = id.replace(this.id + '_', '').replace(/_/g, '.');
      var value = undefined;
      
      try {
        value = eval('json.' + cleanId);
        var input = this.inputs[id];
        if (input && value !== undefined) {
          input.setValue(value, true);
        }
      } catch (ex) {
        console.warn('No value found in JSON', id, cleanId, ex);
      }
    }
  };
  
  Pane.prototype.update = function update(json, parentId) {
    for (var property in json) {
      var value = json[property];
      var schemaId = parentId + '_' + property;
      var schema = this.getSchema(schemaId);
      
      if (!schema) {
        console.warn('No schema found', schemaId, value);
        continue;
      }
      
      if (schema.type === 'object') {
        this.update(value, schemaId);
      } else if (schema.type === 'array') {
        for (var i = 0, len = value.length; i < len; i++) {
          this.addArrayItem(schemaId);
          this.update(value[i], schemaId + '[' + i + ']');
        }
      } else {
        var input = this.inputs[schemaId];
        
        if (input) {
          console.warn('[editor] update', schemaId, schema.type, value, input);
          input.setValue(value);
        }
      }
    }
  };
  
  Pane.prototype.onClick = function onClick(e) {
    var el = e.target;
    
    if (el.dataset.addItem) {
      this.addArrayItem(el.dataset.addItem);
    }
  };
  
  Pane.prototype.addArrayItem = function addArrayItem(schemaId) {
    var schema = this.getSchema(schemaId);
    
    if (!schema) {
      console.warn('Couldnt find schema for', schemaId);
      return;
    }
    
    var elItems = this.el.querySelector('.pane-container-array[data-schema-id = "' + schemaId + '"] .items');
    
    if (elItems) {
      var itemsSchema = schema.items;
      var arrayValue = this.getValue(schemaId);
      var itemIndex = arrayValue.length;
      var elItem = document.createElement('div');
      
      arrayValue.push(this.createJSONFromSchema(itemsSchema));
      
      elItem.className = 'pane-array-item';
      this.createItem(schemaId + '[' + itemIndex + ']', itemsSchema, elItem);
      
      elItems.appendChild(elItem);
    }
  };
  
  Pane.prototype.createObject = function createObject(schemaId, schema, elParent) {
    var el = document.createElement('div');
    el.className = 'pane-container-object';
    el.dataset.schemaId = schemaId;
    el.innerHTML = '<div class="title">' + utils.formatID(schemaId) + '</div>' +
                   '<input type="checkbox" checked class="expand-collapse"></div>' +
                   '<div class="properties collapsible"></div>';
    
    var elProperties = el.querySelector('.properties');
    
    var properties = schema.properties;
    for (var id in properties) {
      this.createItem(schemaId + '_' + id, properties[id], elProperties);
    }
    
    elParent.appendChild(el);
  };
  
  Pane.prototype.createArray = function createArray(schemaId, schema, elParent) {
    var el = document.createElement('div');
    el.className = 'pane-container-array';
    el.dataset.schemaId = schemaId;
    el.innerHTML = '<div class="title">' + 
                     utils.formatID(schemaId) +
                     '<span class="editor-button add-new" data-add-item="' + schemaId + '">+</span>' +
                   '</div>' +
                   '<input type="checkbox" checked class="expand-collapse"></div>' +
                   '<div class="items collapsible"></div>';
    
    elParent.appendChild(el);
    
    this.setValue(schemaId, schema.defaultValue || []);
  };
  
  Pane.prototype.getSchema = function getSchema(schemaId) {
    return this.flatSchema[this.cleanSchemaId(schemaId)];
  };
  
  Pane.prototype.getValue = function getValue(id) {
    var idParts = id.split('_');
    var obj = this.value;
    var arrayRegex = /\[(\d+)\]/;
    var didFind = true;
    
    idParts.splice(0, 1);
    
    for (var i = 0, len = idParts.length; i < len; i++) {
      var idPart = idParts[i];
      var index = -1;
      
      if (arrayRegex.test(idPart)) {
        index = parseInt(idPart.match(arrayRegex)[1], 10);
        idPart = idPart.replace(/(\[\d+\])/g, '');
      }
      
      if (idPart in obj) {
        obj = obj[idPart];
        if (index !== -1) {
          obj = obj[index];
        }
      } else {
        didFind = false;
        break;
      }
    }
    
    return didFind? obj : null;
  };
  
  Pane.prototype.setValue = function setValue(schemaId, value) {
    var idParts = schemaId.split('_');
    var obj = this.value;
    var arrayRegex = /\[(\d+)\]/;
    
    idParts.splice(0, 1);
    
    for (var i = 0, len = idParts.length; i < len; i++) {
      var idPart = idParts[i];
      var index = -1;
      
      if (arrayRegex.test(idPart)) {
        index = parseInt(idPart.match(arrayRegex)[1], 10);
        idPart = idPart.replace(arrayRegex, '');
      }
      
      if (i === len - 1) {
        obj[idPart] = value;
      } else {
      
        if (!obj[idPart]) {
          if (index === -1) {
            obj[idPart] = {};
          } else {
            obj[idPart] = [];
          }
        }
        
        obj = obj[idPart];
        
        if (index !== -1) {
          obj = obj[index];
        }
      }
    }
  };
  
  Pane.prototype.createItem = function createItem(schemaId, schema, elParent) {
    var type = schema.type;

    if (!type) {
      //console.warn('Invalid schema', schemaId, schema);
    } else {
      var hasCustomInput = window['Input_' + type];
      if (!hasCustomInput && type == 'object') {
        this.createObject(schemaId, schema, elParent);
      } else {
        var input = this.createInput(schemaId, schema, elParent);
        this.inputs[schemaId] = input;
      }
    }
  };
  
  Pane.prototype.createInput = function createInput(schemaId, schema, elParent) {
    var type = schema.type;
    var className = window['Input_' + type] || Input;
    
    var input = new className({
      'id': schemaId,
      'pane': this,
      'schema': schema
    });
    
    input.on(input.EVENTS.CHANGE, this.onInputChange.bind(this));
    
    elParent.appendChild(input.el);
    
    return input;
  };
  
  Pane.prototype.createJSONFromSchema = function createJSONFromSchema(schema) {
    var value;
    
    if (!schema) {
      console.warn('Trying to create JSON from invalid schema');
      return value;
    }

    if (schema.type === 'object') {
      value = {};
      for (var id in schema.properties) {
        value[id] = this.createJSONFromSchema(schema.properties[id]);
      }
    } else if (schema.type === 'array') {
      value = [
        this.createJSONFromSchema(schema.items)
      ];
    } else {
      if (schema.hasOwnProperty('default')) {
        value = schema.default;
      } else {
        value = (schema.type === 'text')? '' :
                (schema.type === 'boolean')? false :
                '';
      }
    }
    
    return value;
  };
  
  Pane.prototype.onInputChange = function onInputChange(input, oldValue, newValue) {
    this.setValue(input.id, input.value);
    this.dispatch(this.EVENTS.CHANGE, this, input, oldValue, newValue);
  };
  
  Pane.prototype.cleanSchemaId = function cleanSchemaId(schemaId) {
    return schemaId.replace(/(\[\d+\])/g, '');
  };
  
  return Pane;
}());

var Input = (function Input() {
  function Input(options) {
    this.pane = null;
    this.id = '';
    this.el = null;
    this.elInput = null;
    this.schema = {};
    this.value = null;
    
    this.EVENTS = {
      CHANGE: 'change',
      READY: 'ready'
    };
    
    this.TYPE_MAPPINGS = {
      'boolean': 'checkbox',
      'texture': 'text'
    };
    
    this.init(options);
  }
  
  Input.prototype = Object.create(EventDispatcher.prototype);
  Input.prototype.constructor = Input;
  
  Input.prototype.init = function init(options) {
    this.pane = options.pane;
    this.id = options.id;
    this.schema = options.schema;
    
    if (!this.schema.hasOwnProperty('default')) {
      this.schema.default = this.getDefaultDefaultValue();
    }
    
    this.createHTML();
    
    this.value = this.schema.default;
    
    this.dispatch(this.EVENTS.READY, this);
  };

  Input.prototype.getDefaultDefaultValue = function getDefaultDefaultValue() {
    var defaultValue = '';
    
    if (this.schema.type === 'object') {
      defaultValue = {};
    } else if (this.schema.type === 'array') {
      defaultValue = [];
    } else if (this.schema.type === 'vector') {
      defaultValue = {
        'x': 0,
        'y': 0
      };
    } else if (this.schema.type === 'number') {
      defaultValue = 0;
    } else if (this.schema.type === 'boolean') {
      defaultValue = false;
    }
    
    return defaultValue;
  };

  Input.prototype.setupInput = function setupInput() {
    this.elInput = this.el.querySelector('input');
    if (this.elInput) {
      this.elInput.addEventListener('change', this.onInputChange.bind(this));
    }
  };

  Input.prototype.onInputChange = function onInputChange(e) {
    if (this.schema.type === 'boolean') {
      this.setValue(e.target.checked);
    } else if (this.schema.type === 'number') {
      this.setValue(e.target.value * 1);
    } else {
      this.setValue(e.target.value);
    }
  };

  Input.prototype.setValue = function setValue(value, shouldSupressEvent) {
    var oldValue = this.value;
    
    if (typeof value === 'object') {
      value = JSON.parse(JSON.stringify(value));
    }
    
    this.value = value;
    
    this.update();
    
    if (!shouldSupressEvent) {
      this.dispatch(this.EVENTS.CHANGE, this, oldValue, value);
    }
  };

  Input.prototype.update = function update() {
    if (this.elInput) {
      if (this.schema.type === 'boolean') {
        this.elInput.checked = Boolean(this.value);
      } else {
        this.elInput.value = this.value;
      }
    }
  };

  Input.prototype.createHTML = function createHTML() {
    console.log('[Editor][Input|' + this.id + '] Create HTML');
    
    this.el = document.createElement('div');
    this.el.className = 'input input-' + this.schema.type;
    this.el.setAttribute('title', this.schema.tooltip || 'NO TOOLTIP');
    
    this.el.innerHTML = this.getHTML();
    
    this.setupInput();
  };

  Input.prototype.getHTML = function getHTML() {
    return '<div class="pane-input-label">' + 
              '<label for="' + this.id + '">' + utils.formatID(this.id) + '</label>' +
            '</div>' +
            '<div class="pane-input-field">' + 
              this.getInputHTML() +
            '</div>';
  };

  Input.prototype.getInputHTML = function getInputHTML() {
    var inputType = this.TYPE_MAPPINGS[this.schema.type] || this.schema.type;
    return '<input ' +
              'type="' + inputType + '" ' +
              'id="' + this.id + '" ' +
              'name="' + this.id + '" ' +
              'value="' + this.schema.default + '" />';
  };
  
  return Input;
}());

var Input_vector = (function Input_vector() {
  function Input_vector(options) {
    this.elInputX = null;
    this.elInputY = null;
    
    Input.call(this, options);
  }
  
  Input_vector.prototype = Object.create(Input.prototype);
  Input_vector.prototype.constructor = Input_vector;

  Input_vector.prototype.update = function update() {
    this.elInputX.value = this.value.x;
    this.elInputY.value = this.value.y;
  };
  
  Input_vector.prototype.setupInput = function setupInput() {
    this.elInputX = this.el.querySelector('[data-vector-axis = "x"]');
    this.elInputY = this.el.querySelector('[data-vector-axis = "y"]');
    
    this.el.addEventListener('change', this.onInputChange.bind(this));
  };
  
  Input_vector.prototype.onInputChange = function onInputChange(e) {
    this.setValue({
      'x': this.elInputX.value * 1,
      'y': this.elInputY.value * 1
    });
  };
  
  Input_vector.prototype.getInputHTML = function getInputHTML() {
    var html = '<input type="number" ' +
                      'data-vector-axis="x" ' +
                      'name="' + this.id + '_x" ' +
                      'title="X" ' +
                      'value="' + this.schema.default.x + '" />' +
              '<input type="number" ' +
                      'data-vector-axis="y" ' +
                      'name="' + this.id + '_y" ' +
                      'title="Y" ' +
                      'value="' + this.schema.default.y + '" />';
    
    return html;
  };
  
  return Input_vector;
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
                          
                          '<div class="input input-boolean">' +
                            '<div class="pane-input-label">' +
                              '<label for="">Is Blocking</label>' +
                            '</div>' +
                            '<div class="pane-input-field" title="If true player won\'t be able to pass through this">' +
                              '<input type="checkbox" data-property="isBlocking" data-id="{{id}}" id="actor_isBlocking[{{id}}]" />' +
                              '<label for="actor_isBlocking[{{id}}]">Blocking</label>' +
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
                          
                          '<div class="input input-number input-zIndex">' +
                            '<div class="pane-input-label">' +
                              '<label for="actor_zIndex[{{id}}]">Z-Index</label>' +
                            '</div>' +
                            '<div class="pane-input-field">' +
                              '<input type="number" data-property="zIndex" data-id="{{id}}" title="Actor\'s z-index - higher is closer to camera" id="actor_zIndex[{{id}}]" value="{{zIndex}}" />' +
                            '</div>' +
                          '</div>' +
                          
                        '</div>' +
                        '<div class="actor-modules">' +
                        '</div>';
  
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
    this.el.addEventListener('change', this.onActorsChange.bind(this));
    this.el.querySelector('.create-new').addEventListener('click', this.createNew.bind(this));
  };
  
  Actors.prototype.highlight = function highlight(actor) {
    this.removeHighlight();
    
    var el = this.getActorEl(actor);
    if (el) {
      el.classList.add('highlight');
      this.elList.scrollTop = el.offsetTop - 10;
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
    if (!actor.zIndex) {
      actor.zIndex = 0;
    }
    
    this.actors.push(actor);
    
    el.className = 'actor';
    el.dataset.id = actor.id;
    
    el.innerHTML = TEMPLATE_ACTOR.format(actor);
    
    this.createActorModules(actor, el);

    el.querySelector('[data-property = "isBlocking"]').checked = actor.isBlocking;

    this.elList.appendChild(el);
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
  };
  
  Actors.prototype.onActorModuleChange = function onActorModuleChange(actor, index, data) {
    console.warn('Module change', actor.id, index, data);
    
    actor.modules[index] = data;
    
    this.onChange(this.actors);
  };
  
  Actors.prototype.onTextureChange = function onTextureChange(id) {
    var actor = this.getActor(id);
    var texture = this.textures[id];
    console.warn(id, texture.data)
    actor.texture = JSON.parse(JSON.stringify(texture.data));
    
    this.onChange(this.actorss);
  };
  
  Actors.prototype.createNew = function createNew() {
    var actor = JSON.parse(JSON.stringify(this.actors[this.actors.length - 1]));
    actor.id = prompt('enter id');

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
    var elBlocking = elActor.querySelector('[data-property = "isBlocking"]');
    var elZIndex = elActor.querySelector('[data-property = "zIndex"]');
    
    actor.isBlocking = elBlocking.checked;
    actor.tooltip = elTooltip.value || '';
    actor.zIndex = elZIndex.value || 0;

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
                        
  var TEMPLATE_TILE = '<div class="input input-text">' +
                        '<div class="pane-input-field">' +
                          '<input type="text" data-property="id" data-index="{{index}}" title="Tile\'s ID" id="tile_id[{{index}}]" value="{{id}}" />' +
                        '</div>' +
                        '<div class="pane-input-field" title="If true player won\'t be able to walk over this tile">' +
                          '<input type="checkbox" data-property="isBlocking" data-index="{{index}}" id="tile_isBlocking[{{index}}]" />' +
                          '<label for="tile_isBlocking[{{index}}]">Blocking</label>' +
                        '</div>' +
                      '</div>' +
                      '<b class="editor-button place-tile" data-index="{{index}}" title="Place Tile">&gt;&gt;</b>';
  
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
    this.el.addEventListener('change', this.onTilesChange.bind(this));
    this.el.querySelector('.create-new').addEventListener('click', this.createNew.bind(this));
  };
  
  Tiles.prototype.addTile = function addTile(tile) {
    var el = document.createElement('div');
    
    tile = JSON.parse(JSON.stringify(tile));
    
    tile.index = this.tiles.length;
    this.tiles.push(tile);
    
    el.className = 'tile';
    el.dataset.index = tile.index;
    el.dataset.placing = false;
    
    el.innerHTML = TEMPLATE_TILE.format(tile);
    
    tile.texture.width = this.editor.config.game.tileSize;
    tile.texture.height = this.editor.config.game.tileSize;
    tile.texture.origin = {
      'x': 0,
      'y': 0
    };
    
    this.tilesTextures[tile.index] = new EditorTexture({
      'elContainer': el,
      'data': tile.texture,
      'onChange': this.onTextureChange.bind(this, tile.index)
    });
    
    el.querySelector('[data-property = "isBlocking"]').checked = tile.isBlocking;

    this.elList.appendChild(el);
  };
  
  Tiles.prototype.onTextureChange = function onTextureChange(tileIndex) {
    var tile = this.tiles[tileIndex];
    var texture = this.tilesTextures[tileIndex];
    tile.texture = JSON.parse(JSON.stringify(texture.data));
    
    this.onChange(this.tiles);
  };
  
  Tiles.prototype.createNew = function createNew() {
    var tile = {
      'id': 'default_' + Date.now(),
      'isBlocking': false,
      'texture': JSON.parse(JSON.stringify(this.tiles[this.tiles.length - 1].texture)),
    };

    this.addTile(tile);
    
    this.onChange(this.tiles);
    
    this.elList.scrollTop = 999999;
  };
  
  Tiles.prototype.loadFromGame = function loadFromGame(gameConfig) {
    var tiles = gameConfig.tiles;
    
    for (var i = 0, len = tiles.length; i < len; i++) {
      this.addTile(tiles[i]);
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
  
  Tiles.prototype.onTilesChange = function onTilesChange(e) {
    e && e.stopPropagation();
    
    var elChanged = e.target;
    var index = elChanged.dataset.index * 1;
    var tile = this.tiles[index];
    var elTile = this.getTileEl(tile);
    
    if (!tile || !elTile) {
      return;
    }
    
    tile.isBlocking = elTile.querySelector('[data-property = "isBlocking"]').checked;
    tile.id = elTile.querySelector('[data-property = "id"]').value;
    
    this.onChange(this.tiles);
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


var TextureEditor = (function TextureEditor() {
  function TextureEditor(options) {
    this.el = null;
    this.elContent = null;
    this.elContainer = null;
    this.elImage = null;
    this.elInfo = null;
    this.elSelection = null;
    this.image = null;
    
    this.texture = null;
    
    this.isVisible = false;
    
    this.ratio = 1;
    this.position = {
      'x': 0,
      'y': 0
    };
    
    this.padding = 50;
    
    this.onSelect = null;
    this.isBoundToGrid = true;
    
    this.init(options);
  }
  
  TextureEditor.prototype.init = function init(options) {
    !options && (options = {});
    this.elContainer = options.elContainer || document.body;
    
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    this.createHTML();
  };
  
  TextureEditor.prototype.onKeyDown = function onKeyDown(e) {
    if (e.keyCode === 17) {
      this.isBoundToGrid = false;
    }
  };
  
  TextureEditor.prototype.onKeyUp = function onKeyUp(e) {
    if (e.keyCode === 17) {
      this.isBoundToGrid = true;
    }
  };
  
  TextureEditor.prototype.show = function show(textureData, onUpdate) {
    this.textureData = textureData;
    this.onUpdate = onUpdate || null;
    this.position.x = 0;
    this.position.y = 0;
    
    if (!this.textureData.hasOwnProperty('width')) {
      this.textureData.width = editor.game.config.tileSize;
    }
    if (!this.textureData.hasOwnProperty('height')) {
      this.textureData.height = editor.game.config.tileSize;
    }
    
    this.image = new Image();
    this.image.addEventListener('load', this.onImageLoad.bind(this));
    this.image.src = textureData.src;
    
    this.elSelection.style.width = this.textureData.width + 'px';
    this.elSelection.style.height = this.textureData.height + 'px';
  };
  
  TextureEditor.prototype.hide = function hide() {
    this.el.classList.remove('visible');
    this.isVisible = false;
  };
  
  TextureEditor.prototype.onImageLoad = function onImageLoad(e) {
    var width = this.image.width;
    var height = this.image.height;
    var ratioWidth = (this.elContainer.offsetWidth - this.padding) / width;
    var ratioHeight = (this.elContainer.offsetHeight - this.padding) / height;
    var ratio = Math.min(Math.min(ratioWidth, ratioHeight), 1);

    this.ratio = ratio;
    
    this.elImage.style.backgroundImage = 'url(' + this.image.src + ')';
    
    this.elContent.style.cssText = [
      'width: ' + width + 'px',
      'height: ' + height + 'px',
      'margin-top: ' + -height/2 + 'px',
      'margin-left: ' + -width/2 + 'px',
      'transform: scale(' + ratio + ')'
    ].join(';');
    
    this.el.classList.add('visible');
    
    this.isVisible = true;
  };
  
  TextureEditor.prototype.onMouseMove = function onMouseMove(e) {
    var bounds = this.elContent.getBoundingClientRect();
    var x = Math.round((e.pageX - bounds.left) / this.ratio);
    var y = Math.round((e.pageY - bounds.top) / this.ratio);

    if (this.isBoundToGrid) {
      x -= (x % this.textureData.width);
      y -= (y % this.textureData.height);
    }
    
    this.setPosition(x, y);
  };
  
  TextureEditor.prototype.setPosition = function setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    
    this.elSelection.style.left = this.position.x + 'px';
    this.elSelection.style.top = this.position.y + 'px';
    
    this.elInfo.innerHTML = this.position.x + ',' + this.position.y;
  };
  
  TextureEditor.prototype.onClick = function onClick(e) {
    var elClicked = e.target;
    
    if (elClicked === this.el) {
      this.hide();
    } else {
    
      this.onMouseMove(e);
      
      this.textureData.clip = {
        'x': this.position.x,
        'y': this.position.y
      };
      
      this.hide();
      this.onUpdate(this.textureData);
    }
  };

  TextureEditor.prototype.onKeyPress = function onKeyPress(e) {
    if (e.keyCode === 27) {
      this.hide();
    }
  };
  
  TextureEditor.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    
    this.el.className = 'texture-editor';
    
    this.el.innerHTML = '<div class="content">' +
                          '<div class="image"></div>' +
                          '<div class="info"></div>' +
                          '<div class="selection"></div>' +
                          '<div class="close"></div>' +
                        '</div>';
    this.elContent = this.el.querySelector('.content');
    this.elContent.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.el.addEventListener('click', this.onClick.bind(this));
    window.addEventListener('keyup', this.onKeyPress.bind(this));
    
    this.elImage = this.el.querySelector('.image');
    this.elInfo = this.el.querySelector('.info');
    this.elSelection = this.el.querySelector('.selection');
    
    this.elContainer.appendChild(this.el);
  };
  
  return new TextureEditor();
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
    this.onChange = options.onChange || function(){};
    
    this.createHTML();
    
    this.texture = new Texture(this.data);
    this.texture.on('load', this.drawTexture.bind(this));
  };
  
  EditorTexture.prototype.onClick = function onClick() {
    TextureEditor.show(this.data, this.onUpdateTexture.bind(this));
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


// Format a property id with nice readable names
(window.utils || (window.utils = {})).formatID = function formatID(id) {
  id = id.split('_');
  id = id[id.length - 1];
  
  var formattedId = id[0].toUpperCase();
  
  for (var i = 1, len = id.length; i < len; i++) {
    var char = id[i];
    var prevChar = id[i - 1];
    var nextChar = id[i + 1];
    
    var isUpperCase = char === char.toUpperCase();
    var isPrevUpperCase = prevChar && prevChar === prevChar.toUpperCase();
    var isNextUpperCase = nextChar && nextChar === nextChar.toUpperCase();
    
    if (isUpperCase) {
      formattedId += ' ';
    }
    
    formattedId += char;
  }
  
  return formattedId;
};

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

function closest(el, selector) {
  var matchesSelector = el.matches || el.webkitMatchesSelector || el.mozMatchesSelector || el.msMatchesSelector;
  
  while (el) {
    if (matchesSelector.bind(el)(selector)) {
      return el;
    } else {
      el = el.parentElement;
    }
  }
  
  return false;
}

init();