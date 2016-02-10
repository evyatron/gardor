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
      
      try {
        eval(expr);
      } catch(ex) {
        console.warn('error setting: ', expr);
      }
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
        //console.warn('No value found in JSON', id, cleanId, ex);
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
              'value="' + ('' + this.schema.default).replace(/"/g, '&quot;') + '" />';
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


// Format a property id with nice readable names
(window.utils || (window.utils = {})).formatID = function formatID(id) {
  id = id.split('_');
  id = id[id.length - 1];
  
  var formattedId = id[0].toUpperCase();
  
  for (var i = 1, len = id.length; i < len; i++) {
    var char = id[i];
    var prevChar = id[i - 1] || '';
    
    var currentCase = char === char.toUpperCase()? 'upper' : 'lower';
    var previousCase = prevChar === prevChar.toUpperCase()? 'upper' : 'lower';
    
    !prevChar && (previousCase = '');

    if (currentCase === 'upper' && previousCase === 'lower') {
      formattedId += ' ';
    }
    
    formattedId += char;
  }
  
  return formattedId;
};