/* global utils */
/* global Game */

function init() {
  window.editor = new Editor({
    'game': window.game
  });
}

var HTML_DETAILS_PANE = '<div class="editor-title">Details Pane</div>';
var TEMPLATE_FIELD = '<div class="editor-field field-type-{{type}}" data-id="{{id}}" title="{{tooltip}}">' +
                       '<div class="editor-field-label">' +
                         '<label for="field-{{id}}">{{name}}</label>' +
                       '</div>' +
                       '<div class="editor-field-value">' +
                         '{{input}}' +
                       '</div>' +
                     '</div>';

var TEMPLATES_INPUT = {
  'string': '<input type="text" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />',
  'src': '<input type="text" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />',
  'number': '<input type="number" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />',
  'boolean': '<input type="checkbox" id="field-{{id}}" name="field-{{id}}" checked="{{defaultValue}}" />',
  'array': '<input type="text" id="field-{{id}}" name="field-{{id}}" value="{{defaultValue}}" />'
};

function Editor(options) {
  this.elContainer = null;
  this.el;
  this.game = null;
  this.describer = null;
  
  this.init(options);
}

Editor.prototype.init = function init(options) {
  console.info('[Editor] init');
  
  this.elContainer = options.elContainer || document.body;
  this.createContainers();
  this.createGame();
  
  utils.request('/data/describer.json', this.onGotDescriber.bind(this));
};

Editor.prototype.onGotDescriber = function onGotDescriber(describer) {
  this.describer = describer;
  this.createDetailsPane();
};

Editor.prototype.createGame = function createGame() {
  this.game = new Game({
    'el': document.getElementById('game'),
    'config': '/data/game.json'
  });
  
  this.game.on('mapCreated', this.onMapCreated.bind(this));
  
  if (this.game.isReady) {
    this.onGameCreated(this.game);
  } else {
    this.game.on('created', this.onGameCreated.bind(this));
  }
};

Editor.prototype.buildJSON = function buildJSON() {
  var json = {};
  
  var els = this.elDetails.querySelectorAll('input');
  els = Array.prototype.slice.call(els);
  
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var type = el.getAttribute('type');
    var idParts = el.id.replace('field-', '').split('.');
    var value = el.value;
    var jsonPart = json;
    
    for (var j = 0; j < idParts.length - 1; j++) {
      var idPart = idParts[j];
      if (!jsonPart[idPart]) {
        jsonPart = jsonPart[idPart] = {};
      }
    }
    
    if (type === 'checkbox') {
      eval('json.' + idParts.join('.') + ' = ' + el.checked + ';');
    } else if (type === 'boolean' || type === 'number') {
      eval('json.' + idParts.join('.') + ' = ' + value + ';');
    } else {
      eval('json.' + idParts.join('.') + ' = "' + value + '";');
    }
      
  }
  
  console.warn(json);
};

Editor.prototype.createContainers = function createContainers() {
  this.elDetails = document.createElement('div');
  this.elDetails.className = 'editor-container details-pane';
  this.elContainer.appendChild(this.elDetails);
};

Editor.prototype.createDetailsPane = function createDetailsPane() {
  var data = this.describer;
  var html = HTML_DETAILS_PANE;
  
  for (var id in data) {
    html += this.getFieldHTML(id, data[id]);
  }
  
  this.elDetails.innerHTML = html;
};

Editor.prototype.getFieldHTML = function getFieldHTML(id, field) {
  if (typeof field !== 'object') {
    return '';
  }

  var html = '';
  
  field.id = id;
  if (!field.name) {
    field.name = field.id.split('.');
    field.name = field.name[field.name.length - 1];
  }
  
  if (field.type) {
    var inputTemplate = TEMPLATES_INPUT[field.type] || 'MISSING INPUT: ' + field.type;
    html += TEMPLATE_FIELD.format(field).format({
      'input': inputTemplate.format(field)
    });
  } else {
    html += '<div class="editor-title">' + field.name + '</div>';
    if (id !== 'modules') {
      for (var id in field) {
        html += this.getFieldHTML(field.id + '.' + id, field[id]);
      }
    }
  }
  
  return html;
};

Editor.prototype.onGameCreated = function onGameCreated(game) {
  console.info('[Editor] Game created');
};

Editor.prototype.onMapCreated = function onMapCreated(game) {
  console.info('[Editor] Game map ready');
};

// A template formatting method
// Replaces {{propertyName}} with properties from the 'args' object
// Supports {{object.property}}
// Use {{l10n(key-name)}} to automatically get from l10n object
String.prototype.REGEX_FORMAT = /(\{\{([^\}]+)\}\})/g;
String.prototype.REGEX_FORMAT_L10N = /l10n\(([^\)]*)\)/;
String.prototype.format = function format(args, shouldSanitise) {
  !args && (args = {});

  return this.replace(String.prototype.REGEX_FORMAT, function onMatch() {
    var key = arguments[2],
        properties = key.split('.'),
        value = args,
        l10nMatch = key.match(String.prototype.REGEX_FORMAT_L10N);
    
    if (l10nMatch) {
      value = l10n.get(l10nMatch[1]);
    } else {
      // support nesting - "I AM {{ship.info.name}}"
      for (var i = 0, len = properties.length; i < len; i++) {
        value = value && value[properties[i]];
      }
    }

    if (value === undefined || value === null) {
      value = arguments[0];
    }

    return value;
  });
};


init();