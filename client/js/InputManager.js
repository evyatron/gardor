/*
  Handles player input - used by the Player Controller to hook controls
*/
var InputManager = (function InputManager() {
  function InputManager() {
    this.listeners = {
      'pressed': {},
      'released': {}
    };

    this.isLeftMouseButtonDown = false;
    this.isMiddleMouseButtonDown = false;
    this.isRightMouseButtonDown = false;
    this.pointerPosition = {
      'x': 0,
      'y': 0
    };
    
    this.actionKeys = {};
    this.keyToAction = {};
    this.actionsActive = {};

    this.KEYS_DOWN = {};
    this.justPressed = {};

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
  
  InputManager.prototype.off = function off(event, actionName, callback) {
    if (!this.listeners[event]) {
      return;
    }
    
    if (!this.listeners[event][actionName]) {
      return;
    }

    var listeners = this.listeners[event][actionName];
    for (var i = 0, len = listeners.length; i < len; i++) {
      if (listeners[i] === callback) {
        listeners.splice(i, 1);
        break;
      }
    }
  };

  InputManager.prototype.onMouseMove = function onMouseMove(e) {
    this.pointerPosition.x = e.pageX;
    this.pointerPosition.y = e.pageY;
  };

  InputManager.prototype.onMouseDown = function onMouseDown(e) {
    this.pointerPosition.x = e.pageX;
    this.pointerPosition.y = e.pageY;
    
    var key = this.mouseButtonKeys[e.button];
    if (typeof key === 'number') {
      this.setKeyStatus(key, true, e);
    }
  };

  InputManager.prototype.onMouseUp = function onMouseUp(e) {
    var key = this.mouseButtonKeys[e.button];
    if (typeof key === 'number') {
      this.setKeyStatus(key, false, e);
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
    this.setKeyStatus(e.keyCode, true, e);
  };

  InputManager.prototype.onKeyUp = function onKeyUp(e) {
    this.setKeyStatus(e.keyCode, false, e);
  };
  
  InputManager.prototype.setKeyStatus = function setKeyStatus(key, isDown, event) {
    var isFirstPress = !this.KEYS_DOWN[key];
    var actionName = this.keyToAction[key];
    
    this.KEYS_DOWN[key] = isDown;
    this[this.CODE_TO_KEY[key]] = isDown;
    
    
    if (actionName) {
      if (isFirstPress) {
        this.justPressed[key] = true;
      }
      
      this.actionsActive[actionName] = isDown;

      if (isFirstPress || !isDown) {
        var listeners = this.listeners[isDown? 'pressed' : 'released'][actionName];
        
        if (listeners) {
          for (var i = 0, len = listeners.length; i < len; i++) {
            listeners[i](event);
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