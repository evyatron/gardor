/*
  Inherited class to provide objects with event capabilities
  object.on('event', callback);
  object.dispatch('event', data);
*/
var EventDispatcher = (function EventDispatcher() {
  function EventDispatcher() {
    this._listeners = {};
  }

  EventDispatcher.prototype.dispatch = function dispatch() {
    var args = Array.prototype.slice.call(arguments);
    var eventName = args.splice(0, 1);
    
    if (!this._listeners) {
      this._listeners = {};
    }

    var listeners = this._listeners[eventName] || [];
    for (var i = 0, len = listeners.length; i < len; i++) {
      listeners[i].apply(this, args);
    }
  };

  EventDispatcher.prototype.on = function on(eventName, callback) {
    if (!this._listeners) {
      this._listeners = {};
    }

    if (!this._listeners[eventName]) {
      this._listeners[eventName] = [];
    }

    this._listeners[eventName].push(callback);
  };

  EventDispatcher.prototype.off = function off(eventName, callback) {
    if (!this._listeners) {
      this._listeners = {};
    }

    var listeners = this._listeners[eventName] || [];
    for (var i = 0, len = listeners.length; i < len; i++) {
      if (listeners[i] === callback) {
        listeners.splice(i, 1);
        break;
      }
    }
  };

  EventDispatcher.prototype.once = function once(eventName, callback) {
    if (!this._listeners) {
      this._listeners = {};
    }
    
    this.on(eventName, function callbackOnce() {
      this.off(eventName, callbackOnce);
      callback.apply(this, arguments);
    }.bind(this));
  };

  return EventDispatcher;
}());

/* Helper functions */
var utils = {
  'clamp': function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },
  
  'tilesEqual': function tilesEqual(tileA, tileB) {
    !tileA && (tileA = {});
    !tileB && (tileB = {});
    return (tileA.x === tileB.x && tileA.y === tileB.y);
  },
  
  'getTileOffsetDirection': function getTileOffsetDirection(from, to) {
    return {
      'x': from.x < to.x? 1 : from.x > to.x? -1 : 0,
      'y': from.y < to.y? 1 : from.y > to.y? -1 : 0
    };
  },
  
  'loadScripts': function loadScripts(scripts, callback) {
    var scriptsLoaded = 0;
    var scriptsToLoad = scripts.length;
    
    function onScriptLoad() {
      scriptsLoaded++;
      
      if (scriptsLoaded === scriptsToLoad) {
        callback();
      }
    }
    
    for (var i = 0; i < scriptsToLoad; i++) {
      var el = document.createElement('script');
      el.src = scripts[i];
      el.addEventListener('load', onScriptLoad);
      document.body.appendChild(el);
    }
  },
  
  'request': function request(url, callback) {
    console.log('Request:', url);
    
    var httpRequest = new XMLHttpRequest();
    
    httpRequest.open('GET', url, true);
    
    httpRequest.responseType = 'json';
    
    httpRequest.onload = function onRequestDone(e) {
      callback(e.target.response);
    };
    
    httpRequest.send();
  },
  
  'loadScript': function loadScript(src) {
    var el = document.createElement('script');
    el.src = src;
    document.body.appendChild(el);
  }
};
