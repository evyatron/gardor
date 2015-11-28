/* global utils */
/* global Game */
/* global EventDispatcher */

function init() {
  window.editor = new Editor();
}

var HTML_DETAILS_PANE = '<div class="editor-title">' +
                          'Game Config' +
                          '<input type="checkbox" id="config-debug" name="config-debug" checked />' +
                          '<input type="checkbox" id="config-debug-navmesh" name="config-debug-navmesh" />' +
                        '</div>';
var HTML_MAP_PANE     = '<div class="editor-title">Map Config</div>';
var TEMPLATE_FIELD    = '<div class="editor-field field-type-{{type}}" data-id="{{id}}" title="{{tooltip}}">' +
                           '<div class="editor-field-label">' +
                             '<label for="field-{{id}}">{{name}}</label>' +
                           '</div>' +
                           '<div class="editor-field-value">' +
                             '{{input}}' +
                           '</div>' +
                         '</div>';

var HTML_TEXTURES     = '<div class="editor-title">Textures</div>' +
                        '<div class="editor-button textures-create">New</div>' +
                        '<div class="textures-list"></div>';

var TEMPLATE_TEXTURE  = '<canvas class="image" width="{{tileSize}}" height="{{tileSize}}"></canvas>' +
                        '<textarea data-texture-id="{{id}}">{{content}}</textarea>';

var TEMPLATES_INPUT = {
  'string':   '<input type="text" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />',
  'src':      '<input type="text" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />',
  'number':   '<input type="number" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />',
  'boolean':  '<input type="checkbox" id="field-{{id}}" name="field-{{id}}" checked="{{defaultValue}}" />',
  'array':    '<textarea type="array" id="field-{{id}}" name="field-{{id}}">{{defaultValue}}</textarea>',
  'texture':  '<div class="texture-selector" data-for-field="field-{{id}}">' +
                '<input type="hidden" id="field-{{id}}" name="field-{{id}}">' +
                '<canvas width="64" height="64"></canvas>' +
              '</div>'
};

function Editor(options) {
  this.elContainer = null;
  this.el;
  this.game = null;
  
  this.gameDescriber = null;
  this.mapDescriber = null;
  
  this.gameConfig = null;
  this.mapConfig = null;
  
  this.textures = {};
  
  this.init(options);
}
  
Editor.prototype = Object.create(EventDispatcher.prototype);
Editor.prototype.constructor = Editor;

Editor.prototype.init = function init(options) {
  console.info('[Editor] init');
  
  !options && (options = {});
  
  this.elContainer = options.elContainer || document.body;
  this.createContainers();
  
  this.elContainer.addEventListener('click', this.onClick.bind(this));
  this.elContainer.addEventListener('dragover', this.onDragOver.bind(this));
  this.elContainer.addEventListener('drop', this.onDrop.bind(this));
  
  this.on('textureUpdated', this.onTextureUpdated.bind(this));
  
  utils.request('/data/describer.json', this.onGotGameDescriber.bind(this));
};

Editor.prototype.onClick = function onClick(e) {
  var el = e.target;
  var data = el.dataset || {};
  
  if (el.classList.contains('texture-selector')) {
    console.warn('select texture', data.forField)
  }
};

Editor.prototype.onTextureUpdated = function onTextureUpdated(id) {
  var texture = this.textures[id];
  if (!texture) {
    return;
  }
};

Editor.prototype.onDragOver = function onDragOver(e) {
  e.preventDefault();
};

Editor.prototype.onDrop = function onDrop(e) {
  var el = e.target;
  
  if (el.classList.contains('texture-selector')) {
    var textureId = e.dataTransfer.getData('text');
    var textureData = this.textures[textureId].data;
    
    el.querySelector('input').value = JSON.stringify(textureData);
    var eChange = document.createEvent('HTMLEvents');
    eChange.initEvent('change', true, true);
    el.dispatchEvent(eChange);
  }
};

Editor.prototype.onGotGameDescriber = function onGotGameDescriber(describer) {
  this.gameDescriber = describer.game;
  this.gameConfig = this.createJSON(this.gameDescriber);
  this.createDetailsPane();
  
  this.mapDescriber = describer.map;
  this.mapConfig = this.createJSON(this.mapDescriber);
  this.createMapPane();

  this.createGameFromConfig();
  
  this.createTexture();
  this.createTexture();
  this.createTexture();
  this.createTexture();
};

Editor.prototype.createGameFromConfig = function createGameFromConfig() {
  console.warn('Create game', this.gameConfig);
  
  if (this.game) {
    this.game.destroy();
  }
  this.game = new Game({
    'el': document.getElementById('game'),
    'debug': this.elDetails.querySelector('#config-debug').checked,
    'debugNavmesh': this.elDetails.querySelector('#config-debug-navmesh').checked
  });
  this.game.loadMap = this.loadGameMap.bind(this);
  
  this.game.createGameFromConfig(this.gameConfig);
};

Editor.prototype.loadGameMap = function loadGameMap(mapId, callback) {
  this.mapConfig.id = mapId;
  
  this.game.addMap(this.mapConfig);
  callback && callback(this.mapConfig);
};

Editor.prototype.buildMapJSON = function buildMapJSON() {
  var json = {};
  
  json.grid = [
    [""]
  ];
  json.actors = [
  ];
  
  return json;
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

Editor.prototype.addTiles = function addTiles(json) {
  json.tiles = [];
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

Editor.prototype.onDetailsChange = function onDetailsChange(e) {
  var el = e.target;
  if (/debug/.test(el.id)) {
    this.onDebugChange(e);
    return;
  }
  var id = el.id.replace('field-', '');
  var value = el.value;
  var type = el.getAttribute('type');
  
  if (type === 'text') {
    value = '"' + value + '"';
  } else if (type === 'checkbox') {
    value = el.checked;
  }
  
  var elArrayParent = closest(el, '.field-type-array');
  if (elArrayParent) {
    id = elArrayParent.dataset.id;
    value = [];
    var elItems = elArrayParent.querySelectorAll('.editor-field-value');
    for (var i = 0; i < elItems.length; i++) {
      if (elItems[i].parentNode !== elArrayParent) {
        continue;
      }
      
      var obj = {};
      var elValues = elItems[i].querySelectorAll('input');
      
      for (var j = 0; j < elValues.length; j++) {
        var itemId = elValues[j].id.replace('field-' + id + '.', '');
        var itemValue = elValues[j].value; 
        
        if (elValues[j].type === 'text') {
          itemValue = itemValue;
        } else if (elValues[j].type === 'checkbox') {
          itemValue = elValues[j].checked;
        }
        
        try {
          itemValue = JSON.parse(itemValue);
        } catch(ex) {
          
        }
        
        obj[itemId] = itemValue;
      }
      
      value.push(obj);
    }
  }
  
  this.updateGameConfig(id, value);
};

Editor.prototype.updateGameConfig = function updateGameConfig(id, value) {
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  
  eval('this.gameConfig.' + id + ' = ' + value);
  
  this.createGameFromConfig();
};

Editor.prototype.onMapChange = function onMapChange(e) {
  var el = e.target;
  var id = el.id.replace('field-', '');
  var value = el.value;
  var type = el.getAttribute('type');
  
  if (type === 'text') {
    value = '"' + value + '"';
  } else if (type === 'checkbox') {
    value = el.checked;
  }
  
  eval('this.mapConfig.' + id + ' = ' + value);
  
  this.game.goToMap(this.mapConfig.id);
};

Editor.prototype.createContainers = function createContainers() {
  this.elDetails = document.createElement('div');
  this.elDetails.className = 'editor-container details-pane';
  this.elContainer.appendChild(this.elDetails);
  
  this.elMap = document.createElement('div');
  this.elMap.className = 'editor-container map-pane';
  this.elContainer.appendChild(this.elMap);
  
  this.elTextures = document.createElement('div');
  this.elTextures.className = 'editor-container textures';
  this.elTextures.innerHTML = HTML_TEXTURES;
  this.elContainer.appendChild(this.elTextures);
  
  var elNewTexture = this.elTextures.querySelector('.textures-create');
  elNewTexture.addEventListener('click', this.createTexture.bind(this));
  
  this.elDetails.addEventListener('change', this.onDetailsChange.bind(this));
  this.elMap.addEventListener('change', this.onMapChange.bind(this));
};

Editor.prototype.createDetailsPane = function createDetailsPane() {
  var html = HTML_DETAILS_PANE + this.getDescriberHTML(this.gameDescriber);
  this.elDetails.innerHTML = html;
};

Editor.prototype.createMapPane = function createMapPane() {
  var html = HTML_MAP_PANE + this.getDescriberHTML(this.mapDescriber);
  this.elMap.innerHTML = html;
};

Editor.prototype.getDescriberHTML = function getDescriberHTML(data) {
  var html = '';
  
  for (var id in data) {
    html += this.getFieldHTML(id, data[id]);
  }
  
  return html;
};

Editor.prototype.getFieldHTML = function getFieldHTML(id, field) {
  if (typeof field !== 'object') {
    return '';
  }

  var html = '';

  if (!field.type ||
      field.type === 'map' ||
      (field.type === 'array' && typeof field.value === 'object')
     ) {
    html += '<div class="editor-title">' + (field.name || id) + '</div>';
  }
  
  if (field.type) {
    if (!field.name) {
      field.name = id.split('.');
      field.name = field.name[field.name.length - 1];
    }
    
    var inputTemplate = '';
    
    if (this['template_' + field.type]) {
      inputTemplate = this['template_' + field.type](id, field);
    } else {
      inputTemplate = TEMPLATES_INPUT[field.type] || 'MISSING INPUT: ' + field.type;
    }
    
    html += TEMPLATE_FIELD.format(field).format({
      'id': id,
      'input': inputTemplate.format(field).format({'id': id})
    });
  } else {
    if (id !== 'modules') {
      for (var subFieldId in field) {
        html += this.getFieldHTML(id + '.' + subFieldId, field[subFieldId]);
      }
    }
  }
  
  return html;
};

Editor.prototype.template_map = function template_map(id, field) {
  var html = '';
  
  var key = field.key;
  var value = field.value;
  
  html = key.type + ':{}';
  
  return html;
};

Editor.prototype.template_array = function template_array(id, field) {
  var html = '';
  
  if (typeof field.value === 'string') {
    var inputTemplate = TEMPLATES_INPUT[field.type] || 'MISSING INPUT: ' + field.type;
    
    html += inputTemplate.format({
      'defaultValue': JSON.stringify(field.defaultValue)
    }).format(field).format({
      'id': id
    });
  } else {
    var objectType = field.value;
    for (var subId in objectType) {
      html += this.getFieldHTML(id + '.' + subId, objectType[subId]);
    }
  }
  
  return html;
};

Editor.prototype.createTexture = function createTexture() {
  var elList = this.elTextures.querySelector('.textures-list');
  var el = document.createElement('div');
  var id = 'texture_' + Date.now() + '_' + Math.random();
  el.classList.add('texture');
  el.dataset.textureId = id;
  
  var texture = this.textures[id] = {
    'texture': null,
    'data': {
      'src': '/img/tiles/atlas.png',
      'origin': [0, 0],
      'clip': [0, 0],
      'width': 32,
      'height': 32,
      'scale': 1
    }
  };
  
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
};

Editor.prototype.openTextureImage = function openTextureImage(e) {
  var el = e.target.parentNode;
  var id = el.dataset.textureId;
  var texture = this.textures[id];
  
  if (texture) {
    ImageViewer.show(texture.data.src);
  }
};

Editor.prototype.onTextureChange = function onTextureChange(e) {
  var id = e.target.dataset.textureId;
  var texture = this.textures[id];
  var el = e.target.parentNode;
  
  if (!texture) {
    return;
  }
  
  var value = e.target.value;
  try {
    value = JSON.parse(value);
  } catch(eX) {
    value = null;
    alert('Invalid JSON entered');
  }
  
  if (value) {
    this.textures[id].data = texture.data = value;
    texture.texture = new Texture(texture.data);
    
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

    /*
    el.innerHTML = TEMPLATE_TEXTURE.format(texture.data).format({
      'id': id,
      'content': JSON.stringify(texture.data)
    });
    */
    
    this.dispatch('textureUpdated', id);
  }
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
    
    this.init(options);
  }
  
  ImageViewer.prototype.init = function init(options) {
    !options && (options = {});
    this.elContainer = options.elContainer || document.body;
    
    this.createHTML();
  };
  
  ImageViewer.prototype.show = function show(imagsrc) {
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