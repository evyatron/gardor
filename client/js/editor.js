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
  
  this.paneGame = new Pane({
    'id': 'game',
    'el': this.elGamePane,
    'schema': this.schema.game,
    'onChange': this.refreshGame.bind(this)
  });
  this.paneMap = new Pane({
    'id': 'map',
    'el': this.elMapPane,
    'schema': this.schema.map,
    'onChange': this.refreshMap.bind(this)
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

  this.game.createGameFromConfig(config);
  
  this.disablePlay();
};

Editor.prototype.onGameClick = function onGameClick(data) {
  if (this.isPlayable) {
    return;
  }
  
  if (this.heldActor) {
    this.placeActorOnTile(this.heldActor, data.tile);
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
    this.paneMap.updateFromJSON(mapConfig);
    
    this.game.addMap(mapConfig);
    callback && callback(mapConfig);
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

Editor.prototype.onDebugChange = function onDebugChange(e) {
  var el = e.target;
  var state = el.checked;
  
  if (el.id === 'config-debug') {
    this.game.setDebug(state);
  } else if (el.id === 'config-debug-navmesh') {
    this.game.setDebugNavmesh(state);
  }
};

Editor.prototype.enablePlay = function enablePlay() {
  this.isPlayable = true;
  this.game.playerController.enable();
  this.elPlayable.checked = true;
};

Editor.prototype.disablePlay = function disablePlay() {
  this.isPlayable = false;
  this.game.playerController.disable();
  this.elPlayable.checked = false;
};

Editor.prototype.onPlayableChange = function onPlayableChange() {
  if (this.elPlayable.checked) {
    this.enablePlay();
  } else {
    this.disablePlay();
  }
};






Editor.prototype.onTilesChange = function onTilesChange(tiles) {
  this.gameConfig.tiles = tiles;
  this.createGameFromConfig();
};

Editor.prototype.populateData = function populateData(data, config, parentDescriber, elParent) {
  for (var k in data) {
    var describer = parentDescriber[k];
    if (!describer) {
      console.warn('No describer node found for', k, data[k]);
      continue;
    }
    
    if (k === 'tiles') {
      this.tilesEditor.create(data[k]);
      continue;
    }
    
    var type = describer.type;
    var el = this.getField(k, elParent);
    
    if (Array.isArray(describer)) {
      
    } else if (type === 'map') {
      config[k] = JSON.parse(JSON.stringify(data[k]));
    } else if (type === 'array') {
      config[k] = JSON.parse(JSON.stringify(data[k]));
      
      if (el) {
        el.value = JSON.stringify(data[k]);
      }
    } else if (!type) {
        var parentValue = data[k];
        for (var subK in parentValue) {
          var elSub = this.getField(k + '.' + subK, elParent);
          if (elSub) {
            elSub.value = parentValue[subK];
          } else {
            console.warn('No iput element found for field', k + '.' + subK);
          }
        }
    } else {
      config[k] = data[k];
      
      if (el) {
        if (type === 'boolean') {
          el.checked = data[k];
        } else {
          el.value = data[k];
        }
      } else {
        console.warn('No input element found for field', k);
      }
    }
  }
};

Editor.prototype.getField = function getField(id, elParent) {
  return (elParent || this.elContainer).querySelector('[data-field-id = "' + id + '"]');
};

Editor.prototype.createGameFromConfig = function createGameFromConfig() {
  console.warn('Create game', this.gameConfig);
  
  if (this.game) {
    this.game.destroy();
  }
  
  this.game = new Game({
    'el': document.getElementById('game'),
    'debug': this.elGamePane.querySelector('#config-debug').checked,
    'debugNavmesh': this.elGamePane.querySelector('#config-debug-navmesh').checked
  });
  
  this.game.loadMap = this.loadGameMap.bind(this);
  
  this.game.createGameFromConfig(this.gameConfig);
};

Editor.prototype.createJSON = function createJSON(describer) {
  var json = {};
  
  for (var k in describer) {
    json[k] = this.getJSONProperty(describer[k]);
  }
  
  json = JSON.parse(JSON.stringify(json));
  
  return json;
};

Editor.prototype.getJSONProperty = function getJSONProperty(json) {
  var result = json.defaultValue;
  
  if (!json.type) {
    if (Array.isArray(json)) {
      result = json;
    } else {
      result = {};
      for (var k in json) {
        result[k] = this.getJSONProperty(json[k]);
      }
    }
  }
  
  return result;
};



/* Textures handling */

Editor.prototype.onDragStart = function onDragStart(e) {
  this.elDragging = e.target;
  e.target.classList.add('dragging');
  document.body.classList.add('dragging-texture');
};

Editor.prototype.onDragOver = function onDragOver(e) {
  e.preventDefault();
  
  var el = e.target;
  if (el.classList.contains('texture-selector')) {
    this.elDropZone = el;
    el.classList.add('dragging-over');
  } else if (this.elDropZone) {
    this.elDropZone.classList.remove('dragging-over');
  }
};

Editor.prototype.onDrop = function onDrop(e) {
  var el = e.target;
  
  if (this.elDragging) {
    this.elDragging.classList.remove('dragging');
    this.elDragging = null;
  }
  if (this.elDropZone) {
    this.elDropZone.classList.remove('dragging-over');
    this.elDropZone = null;
  }
  
  if (el.classList.contains('texture-selector')) {
    var textureId = e.dataTransfer.getData('text');
    this.setTexture(el, textureId);
    
    var eChange = document.createEvent('HTMLEvents');
    eChange.initEvent('change', true, true);
    el.dispatchEvent(eChange);
  }
  
  document.body.classList.remove('dragging-texture');
};

Editor.prototype.setTexture = function setTexture(elTexture, id) {
  var texture = this.textures[id];
  var canvas = elTexture.querySelector('canvas');
  var context = canvas.getContext('2d');
  
  canvas.width = texture.data.width || this.gameConfig.tileSize;
  canvas.height = texture.data.height || this.gameConfig.tileSize;
  texture.texture.draw(context, 0, 0);
  
  elTexture.querySelector('input').value = JSON.stringify(texture.data);
};

Editor.prototype.pickupTexture = function pickupTexture(elTextureSelector) {
  var elTexture = closest(elTextureSelector, '.field-type-texture');
  if (elTexture) {
    var elField = elTexture.parentNode;
    var textureId = elField.querySelector('input').value;
    if (textureId) {
      if (textureId === this.heldTextureId) {
        this.heldTextureId = '';
        elField.classList.remove('held-texture');
        this.enablePlay();
      } else {
        var elSelected = this.elGamePane.querySelector('.held-texture');
        if (elSelected) {
          elSelected.classList.remove('held-texture');
        }
        this.heldTextureId = textureId;
        elField.classList.add('held-texture');
        this.disablePlay();
      }
    }
  }
};

Editor.prototype.placeTexture = function placeTexture(x, y) {
  if (this.heldTextureId) {
    var bounds = this.game.el.getBoundingClientRect();
    var tile = this.game.getTileFromCoords({
      'x': x - bounds.left,
      'y': y - bounds.top
    });
    
    var grid = this.mapConfig.grid;
    var numberOfCols = grid[0].length;
    var didChangeGrid = false;
    var gridChange = {
      'x': 0,
      'y': 0
    };

    if (tile.y < 0) {
      gridChange.y = -1;
      
      var row = [];
      for (var i = 0; i < numberOfCols; i++) {
        row.push('');
      }
      this.mapConfig.grid.splice(0, 0, row);
    } else if (tile.y > grid.length - 1) {
      gridChange.y = 1;
      
      var row = [];
      for (var i = 0; i < numberOfCols; i++) {
        row.push('');
      }
      this.mapConfig.grid.push(row);
    }
    
    if (tile.x < 0) {
      gridChange.x = -1;
      
      for (var i = 0; i < grid.length; i++) {
        grid[i].splice(0, 0, '');
      }
    } else if (tile.x > numberOfCols - 1) {
      gridChange.x = 1;
      
      for (var i = 0; i < grid.length; i++) {
        grid[i].push('');
      }
    }
    
    if (gridChange.x === 0 && gridChange.y === 0) {
      this.mapConfig.grid[tile.y][tile.x] = this.heldTextureId;
    } else if (gridChange.x < 0 || gridChange.y < 0) {
      for (var i = 0, len = this.mapConfig.actors.length; i < len; i++) {
        if (gridChange.x < 0) {
          this.mapConfig.actors[i].tile.x += -gridChange.x;
        }
        if (gridChange.y < 0) {
          this.mapConfig.actors[i].tile.y += -gridChange.y;
        }
      }
    }
    
    this.elMapPane.querySelector('#field-grid').textContent = JSON.stringify(this.mapConfig.grid);
    
    this.loadMapFromConfig();
  }
};

Editor.prototype.onTextureUpdated = function onTextureUpdated(id) {
  var texture = this.textures[id];
  if (!texture) {
    return;
  }
};

Editor.prototype.createTexture = function createTexture(textureData) {
  var elList = this.elTextures.querySelector('.textures-list');
  var el = document.createElement('div');
  var id = 'texture_' + Date.now() + '_' + Math.random();
  
  el.classList.add('texture');
  
  el.dataset.textureId = id;
  
  var texture = {
    'texture': null,
    'data': textureData || {
      'src': '/img/tiles/atlas.png',
      'origin': [0, 0],
      'clip': [0, 0],
      'width': 32,
      'height': 32,
      'scale': 1
    }
  };
  
  this.textures[id] = texture;
  
  el.setAttribute('draggable', true);
  
  el.addEventListener('dragstart', function onDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.textureId);
  });
  
  elList.appendChild(el);
  
  el.innerHTML = TEMPLATE_TEXTURE.format(texture.data).format({
    'tileSize': this.gameConfig.tileSize,
    'id': id,
    'content': JSON.stringify(texture.data)
  });
  
  this.onTextureChange({
    'target': el.querySelector('textarea')
  });

  el.addEventListener('change', this.onTextureChange.bind(this));
  el.querySelector('.image').addEventListener('click', this.openTextureImage.bind(this));
  
  return id;
};

Editor.prototype.openTextureImage = function openTextureImage(e) {
  var el = e.target.parentNode;
  var id = el.dataset.textureId;
  var texture = this.textures[id];
  
  if (texture) {
    ImageViewer.show(texture.data.src, function onSelect(x, y) {
      texture.data.clip[0] = x;
      texture.data.clip[1] = y;
      this.updateTexture(id);
    }.bind(this));
  }
};

Editor.prototype.onTextureChange = function onTextureChange(e) {
  var id = e.target.dataset.textureId;
  var value = e.target.value;
  
  try {
    value = JSON.parse(value);
  } catch(eX) {
    value = null;
    alert('Invalid JSON entered');
  }
  
  if (value) {
    this.textures[id].data = value;
    this.updateTexture(id);
  }
};

Editor.prototype.updateTexture = function updateTexture(id) {
  var texture = this.textures[id];
  var el = this.elTextures.querySelector('.texture[data-texture-id = "' + id + '"');
  
  if (!texture) {
    return;
  }
  
  texture.texture = new Texture(texture.data);
  el.querySelector('textarea').textContent = JSON.stringify(texture.data);
  
  function onLoad() {
    var context = el.querySelector('canvas').getContext('2d');
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    texture.texture.draw(context, 0, 0);
  }
  
  if (texture.texture.isReady) {
    onLoad();
  } else {
    texture.texture.on('load', onLoad);
  }
  
  this.dispatch('textureUpdated', id);
};


var ImageViewer = (function ImageViewer() {
  function ImageViewer(options) {
    this.elContainer = null;
    this.elBody = null;
    this.elImage = null;
    this.elInfo = null;
    this.image = null;
    
    this.isVisible = false;
    
    this.ratio = 1;
    this.position = {
      'x': 0,
      'y': 0
    };
    
    this.padding = 50;
    
    this.onSelect = null;
    
    this.init(options);
  }
  
  ImageViewer.prototype.init = function init(options) {
    !options && (options = {});
    this.elContainer = options.elContainer || document.body;
    
    this.createHTML();
  };
  
  ImageViewer.prototype.show = function show(imagsrc, onSelect) {
    this.onSelect = onSelect || null;
    this.image = new Image();
    this.image.addEventListener('load', this.onImageLoad.bind(this));
    this.image.src = imagsrc;
  };
  
  ImageViewer.prototype.hide = function hide() {
    this.el.classList.remove('visible');
    this.isVisible = false;
  };
  
  ImageViewer.prototype.onImageLoad = function onImageLoad(e) {
    var width = this.image.width;
    var height = this.image.height;
    var ratioWidth = (this.elContainer.offsetWidth - this.padding) / width;
    var ratioHeight = (this.elContainer.offsetHeight - this.padding) / height;
    var ratio = Math.min(ratioWidth, ratioHeight);
    
    if (ratio < 1) {
      width *= ratio;
      height *= ratio;
    }
    
    this.ratio = ratio;
    
    this.elImage.style.backgroundImage = 'url(' + this.image.src + ')';
    this.elImage.style.backgroundSize = width + 'px ' + height + 'px';
    
    this.el.style.cssText = [
      'width: ' + width + 'px',
      'height: ' + height + 'px',
      'margin-top: ' + -height/2 + 'px',
      'margin-left: ' + -width/2 + 'px'
    ].join(';');
    
    this.el.classList.add('visible');
    
    this.isVisible = true;
  };
  
  ImageViewer.prototype.onMouseMove = function onMouseMove(e) {
    var bounds = this.el.getBoundingClientRect();
    var x = e.pageX - bounds.left;
    var y = e.pageY - bounds.top;
    this.position.x = Math.round(x / this.ratio);
    this.position.y = Math.round(y / this.ratio);
    
    this.elLineV.style.left = x + 'px';
    this.elLineH.style.top = y + 'px';
    
    this.elInfo.innerHTML = this.position.x + ',' + this.position.y;
  };
  
  ImageViewer.prototype.onClick = function onClick(e) {
    this.onMouseMove(e);
    this.logPosition();
    
    if (this.onSelect) {
      this.hide();
      this.onSelect(this.position.x, this.position.y);
    }
  };
  
  ImageViewer.prototype.logPosition = function logPosition() {
    var x = this.position.x;
    var y = this.position.y;
    
    console.warn(x + ',' + y, '[' + x + ',' + y + ']', '{"x": ' + x + ', "y": ' + y + '}');
  };
  
  ImageViewer.prototype.onKeyPress = function onKeyPress(e) {
    if (e.keyCode === 27) {
      this.hide();
    }
  };
  
  ImageViewer.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    this.el.classList.add('image-viewer');
    this.el.innerHTML = '<div class="image"></div>' +
                        '<div class="info"></div>' +
                        '<div class="line h"></div>' +
                        '<div class="line v"></div>' +
                        '<div class="close"></div>';
    
    this.el.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.el.addEventListener('click', this.onClick.bind(this));
    window.addEventListener('keyup', this.onKeyPress.bind(this));
    
    this.elImage = this.el.querySelector('.image');
    this.elInfo = this.el.querySelector('.info');
    this.elLineV = this.el.querySelector('.line.v');
    this.elLineH = this.el.querySelector('.line.h');
    
    this.elContainer.appendChild(this.el);
  };
  
  return new ImageViewer();
}());


utils.formatID = function formatID(id) {
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
                      'value="' + this.schema.default.x + '" />' +
              '<input type="number" ' +
                      'data-vector-axis="y" ' +
                      'name="' + this.id + '_y" ' +
                      'value="' + this.schema.default.y + '" />';
    
    return html;
  };
  
  return Input_vector;
}());



var Tiles = (function Tiles() {
  function Tiles(options) {
    this.elContainer = null;
    this.el = null;
    
    this.editor = null;
    this.schema = {};
    this.onChange = null;
    
    this.init(options);
  }
  
  Tiles.prototype.init = function init(options) {
    this.editor = options.editor;
    this.elContainer = options.elContainer;
    this.schema = options.schema;
    this.onChange = options.onChange;
    
    this.el = document.createElement('div');
    this.el.className = 'tiles-editor';
    this.el.innerHTML = '<div class="editor-button create-new-tile">New Tile</div>';
    
    this.elContainer.appendChild(this.el);
    
    this.el.addEventListener('change', this.onTilesChange.bind(this));
    this.el.querySelector('.create-new-tile').addEventListener('click', this.createNew.bind(this));
  };
  
  Tiles.prototype.addTile = function addTile(tile) {
    var el = document.createElement('div');
    var html = '';
    var textureId = '';
    
    el.className = 'tile';

    for (var k in tile) {
      var schema = JSON.parse(JSON.stringify(this.schema[k]));
      
      schema.defaultValue = tile[k];
      
      if (schema.type === 'texture') {
        schema.defaultValue = JSON.stringify(schema.defaultValue).replace(/"/g, '&quot;');
        textureId = this.editor.createTexture(tile[k]);
      }
      
      html += this.editor.getFieldHTML(k, schema);
    }
    
    el.innerHTML = html;
    
    var elUncheckedBoxes = el.querySelectorAll('input[type = "checkbox"][checked = "false"]');
    for (var i = 0, len = elUncheckedBoxes.length; i < len; i++) {
      elUncheckedBoxes[i].checked = false;
    }
    
    this.el.appendChild(el);
    
    window.setTimeout(function() {
      this.editor.setTexture(el.querySelector('.texture-selector'), textureId);
    }.bind(this), 100);
  };
  
  Tiles.prototype.createNew = function createNew() {
    var tile = {};
    
    for (var k in this.schema) {
      tile[k] = this.schema[k].defaultValue;
    }
    
    this.addTile(tile);
    
    this.onTilesChange();
  };
  
  Tiles.prototype.create = function create(tiles) {
    for (var i = 0, len = tiles.length; i < len; i++) {
      this.addTile(tiles[i]);
    }
  };
  
  Tiles.prototype.getTiles = function getTiles() {
    var tiles = [];
    var els = this.el.querySelectorAll('.tile');
    
    for (var i = 0, len = els.length; i < len; i++) {
      var el = els[i];
      var tile = {};
      var elInputs = el.querySelectorAll('input');
      
      for (var j = 0, jLen = elInputs.length; j < jLen; j++) {
        var elInput = elInputs[j];
        var value = elInput.value;
        
        if (elInput.type === 'checkbox') {
          value = elInput.checked;
        } else if (elInput.dataset.fieldId === 'texture') {
          value = JSON.parse(value);
        }

        tile[elInput.dataset.fieldId] = value;
      }
      
      tiles.push(tile);
    }

    return tiles;
  };
  
  Tiles.prototype.onTilesChange = function onTilesChange(e) {
    e && e.stopPropagation();
    
    this.onChange(this.getTiles());
  };
  
  return Tiles;
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



/*
  water island tiles
  [{"id":"land","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","clip":[192,32],"origin":[0,0]}},{"id":"water1","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","clip":[193,351],"origin":[0,0]}},{"id":"path","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","clip":[224,352],"origin":[0,0]}},{"id":"water2","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","clip":[250,354],"origin":[0,0]}},{"id":"water3","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","clip":[192,383],"origin":[0,0]}},{"id":"water","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[224,385],"width":32,"height":32,"scale":1}},{"id":"water5","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[247,384],"width":32,"height":32,"scale":1}},{"id":"grass","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[706,96],"width":32,"height":32,"scale":1}},{"id":"water6","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[194,411],"width":32,"height":32,"scale":1}},{"id":"water7","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[224,410],"width":32,"height":32,"scale":1}},{"id":"water8","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[247,410],"width":32,"height":32,"scale":1}},{"id":"grass2","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[673,160],"width":32,"height":32,"scale":1}},{"id":"grass3","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[735,160],"width":32,"height":32,"scale":1}},{"id":"island","isBlocking":true,"texture":{"src":"/img/tiles/atlas.png","origin":[0,0],"clip":[224,448],"width":32,"height":32,"scale":1}}]
  water island grid
  [["land","land","land","land","land","land","land","land","land","land","land"],["land","grass","grass3","grass","grass","grass","grass","grass","grass","grass","land"],["land","grass3","grass","grass","grass3","grass","grass","grass2","grass3","grass","land"],["land","grass","grass","water1","path","path","path","water2","grass","grass","land"],["land","grass","grass","water3","island","water","water","water5","grass","grass","land"],["land","grass","grass2","water3","water","island","water","water5","grass","grass","land"],["land","grass","grass","water3","water","water","water","water5","grass","grass","land"],["land","grass","grass","water6","water7","water7","water7","water8","grass","grass","land"],["land","grass3","grass3","grass","grass","grass","grass3","grass","grass","grass2","land"],["land","grass2","grass","grass","grass","grass3","grass","grass","grass","grass","land"],["land","land","land","land","land","grass","grass","grass","land","land","land"],["land","land","land","land","land","grass","grass","grass","grass","grass","land"]]
*/



  /*
  
  this.createContainers();
  
  this.elContainer.addEventListener('click', this.onClick.bind(this));
  
  this.elContainer.addEventListener('dragstart', this.onDragStart.bind(this));
  this.elContainer.addEventListener('dragover', this.onDragOver.bind(this));
  this.elContainer.addEventListener('drop', this.onDrop.bind(this));
  
  this.on('textureUpdated', this.onTextureUpdated.bind(this));
  */
  
  //utils.request('/data/schema.json', this.onGotSchema.bind(this));

/*
Editor.prototype.createContainers = function createContainers() {
  this.elGamePane = document.createElement('form');
  this.elGamePane.className = 'editor-container vertical details-pane';
  this.elGamePane.innerHTML = HTML_GAME_PANE;
  this.elGamePane.addEventListener('change', this.refreshGame.bind(this));
  
  this.elContainer.appendChild(this.elGamePane);
  
  this.elMapPane = document.createElement('form');
  this.elMapPane.className = 'editor-container vertical map-pane';
  this.elMapPane.innerHTML = HTML_MAP_PANE;
  this.elMapPane.addEventListener('change', this.refreshGame.bind(this));
  
  this.elContainer.appendChild(this.elMapPane);
  
  /*
  this.elTextures = document.createElement('form');
  this.elTextures.className = 'editor-container horizontal textures';
  this.elTextures.innerHTML = HTML_TEXTURES;
  this.elContainer.appendChild(this.elTextures);
  
  var elNewTexture = this.elTextures.querySelector('.textures-create');
  elNewTexture.addEventListener('click', this.createTexture.bind(this, null));
  *-/
  
};

*/

/*
Editor.prototype.onGotSchema = function onGotSchema(schema) {
  this.schema = schema;
  
  this.schema.game = this.updateSchemaWithTemplates(this.schema.game, schema.templates);
  this.schema.map = this.updateSchemaWithTemplates(this.schema.map, schema.templates);

  this.loadGame();
};

Editor.prototype.updateSchemaWithTemplates = function updateSchemaWithTemplates(schema, templates) {
  if (templates[schema.type]) {
    schema = JSON.parse(JSON.stringify(templates[schema.type]));
  }
  
  if (schema.type === 'object') {
    for (var k in schema.properties) {
      schema.properties[k] = this.updateSchemaWithTemplates(schema.properties[k], templates);
      schema.properties[k].title = utils.formatID(k);
    }
  } else if (schema.type === 'array') {
    schema.items = this.updateSchemaWithTemplates(schema.items, templates);
  }
  
  return schema;
};
*/