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
  this.game.on(this.game.EVENTS.POINTER_TILE_CHANGE, this.onGamePointerTileChange.bind(this));
};

Editor.prototype.onGameReady = function onGameReady() {
  var config = JSON.parse(JSON.stringify(this.config.game));
  
  this.paneGame.updateJSON(config);
  
  this.tilesEditor.loadFromGame(config);

  this.game.createGameFromConfig(config);
};

Editor.prototype.onGameClick = function onGameClick(data) {
  if (this.isPlayable) {
    return;
  }
  
  var tile = data.tile;
  
  // Change tiles
  if (this.tilesEditor.placingTile) {
    var tileId = this.tilesEditor.placingTile.id;
    var grid = this.config.map.grid;
    
    grid[tile.y][tile.x] = tileId;
    
    this.game.currentMap = JSON.parse(JSON.stringify(this.config.map));
    this.game.layers.background.createTexture();
    this.game.navMesh.update();
    
    return;
  }
  
  // Move actors
  if (this.heldActor) {
    this.placeActorOnTile(this.heldActor, tile);
  } else {
    var actorOnTile = data.actors[Object.keys(data.actors)[0]];
    
    if (actorOnTile) {
      this.heldActor = actorOnTile;
      this.heldActor.setAlpha(0.5);
    }
  }
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
  
  Pane.prototype.load = function load(url) {
    this.describerURL = url;
    utils.request(url, this.setSchema.bind(this));
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
        var value = eval('json.' + cleanId);
        var input = this.inputs[id];
        if (input && value !== undefined) {
          input.setValue(value, true);
        }
      } catch (ex) {
        console.warn('No value found in JSON', id, cleanId, ex);
      }
    }
    
    //this.dispatch(this.EVENTS.CHANGE, this);
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
                   '<div class="properties"></div>';
    
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
                   '<div class="items"></div>';
    
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



var Tiles = (function Tiles() {
  var TEMPLATE_TILES = '<div class="editor-title">' +
                          'Tiles' +
                          '<div class="editor-button create-new-tile">New Tile</div>' +
                        '</div>' +
                        '<div class="tiles-list"></div>';
                        
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
    this.el.querySelector('.create-new-tile').addEventListener('click', this.createNew.bind(this));
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
    var ratio = Math.min(ratioWidth, ratioHeight);

    this.ratio = ratio;
    
    this.elImage.style.backgroundImage = 'url(' + this.image.src + ')';
    
    this.el.style.cssText = [
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
    var bounds = this.el.getBoundingClientRect();
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
    this.onMouseMove(e);
    
    this.textureData.clip = {
      'x': this.position.x,
      'y': this.position.y
    };
    
    this.hide();
    this.onUpdate(this.textureData);
  };

  TextureEditor.prototype.onKeyPress = function onKeyPress(e) {
    if (e.keyCode === 27) {
      this.hide();
    }
  };
  
  TextureEditor.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    
    this.el.className = 'texture-editor';
    
    this.el.innerHTML = '<div class="image"></div>' +
                        '<div class="info"></div>' +
                        '<div class="selection"></div>' +
                        '<div class="close"></div>';
    
    this.el.addEventListener('mousemove', this.onMouseMove.bind(this));
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
    if (char === char.toUpperCase()) {
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