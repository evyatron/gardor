/* Base class for every Object and Character */
var Actor = (function Actor() {
  function Actor(options) {
    this.id = '';
    this.tooltip = '';
    this.direction = '';
    this.isBlocking = false;
    this.zIndex = 0;
    
    this.speed = 0;
    
    this.targetTile = null;
    this.targetPosition = null;
    this.onReachTarget = null;
    
    this.isPointerOver = false;
    
    this.tile = {
      'x': 0,
      'y': 0
    };
    this.position = {
      'x': 0,
      'y': 0
    };
    this.drawPosition = {
      'x': 0,
      'y': 0
    };
    this.pathToWalk = null;
    
    this.textureModule = null;
    this.modules = [];
    
    this.isReady = false;
    
    this.init(options);
  }
  
  Actor.prototype.init = function init(options) {
    !options && (options = {});
    
    this.id = options.id || 'actor_' + Date.now() + '_' + Math.random();
    this.tooltip = options.tooltip || '';
    this.layer = options.layer;
    this.game = this.layer.game;
    this.speed = options.speed || 0;
    this.zIndex = options.zIndex || 0;
    this.isBlocking = 'isBlocking' in options? options.isBlocking : false;
    this.direction = options.direction || 'top';
    this.tile = options.tile || {
      'x': 0,
      'y': 0
    };
    
    this.position = this.game.getCoordsFromTile(this.tile);
    this.drawPosition = this.game.getOffsetPosition(this.position);

    this.initModules(options.modules || []);
    
    console.log('[Actor] create', this);
  };
  
  Actor.prototype.setDirection = function setDirection(direction) {
    if (this.direction === direction) {
      return false;
    }

    this.direction = direction;
    
    return true;
  };
  
  Actor.prototype.initModules = function initModules(modules) {
    for (var i = 0, len = modules.length; i < len; i++) {
      var moduleData = modules[i];
      var moduleClass = moduleData.type;
      
      if (!window[moduleClass]) {
        console.warn('No module found ', moduleData);
        continue;
      }
      
      moduleData.actor = this;

      var module = new window[moduleClass](moduleData);
      this.modules.push(module);
      
      if (module instanceof ModuleTexture) {
        this.textureModule = module;
      }
    }

    return true;
  };
  
  Actor.prototype.getTexture = function getTexture() {
    if (this.textureModule) {
      return this.textureModule.texture;
    }
  };
  
  Actor.prototype.setAlpha = function setAlpha(alpha) {
    if (this.textureModule) {
      this.textureModule.texture.setAlpha(alpha);
    }
  };
  
  Actor.prototype.onClick = function onClick(e) {
    var wasClickHandled = false;
    
    for (var i = 0, len = this.modules.length; i < len; i++) {
      var module = this.modules[i];
      if (module.onClick && module.onClick(e)) {
        wasClickHandled = true;
      }
    }
    
    return wasClickHandled;
  };
  
  Actor.prototype.moveTo = function moveTo(targetTile, onReach) {
    if (this.speed === 0) {
      console.warn('Trying to move an actor with no speed', targetTile, this);
      return false;
    }
    
    if (utils.tilesEqual(targetTile, this.tile)) {
      onReach && onReach();
    } else {
      this.onReachTarget = onReach;
      this.game.navMesh.findPath(this.tile, targetTile, this.onGotPath.bind(this));
      
      console.log(this.id, 'move actor to', targetTile);
    }
    
    return true;
  };
  
  Actor.prototype.onGotPath = function onGotPath(path) {
    this.pathToWalk = path;
    
    if (path && path.length > 0) {
      this.targetTile = path[0];
      this.targetPosition = this.game.getCoordsFromTile(path[0]);
    } else {
      this.pathToWalk = null;
      this.targetTile = null;
      this.targetPosition = null;
      this.onReachTarget = null;
    }
  };
  
  Actor.prototype.updateTile = function updateTile(tile) {
    if (!utils.tilesEqual(tile, this.tile)) {
      this.tile = tile;
      this.position = this.game.getCoordsFromTile(this.tile);
      this.layer.sortActors();
      
      if (this.isBlocking) {
        this.game.navMesh.update();
      }
    }
  };
  
  Actor.prototype.update = function update(dt) {
    var game = this.game;
    
    game.startBenchmark('update', this.id);
    
    this.isPointerOver = game.actorsUnderPointer.hasOwnProperty(this.id);
    
    if (this.pathToWalk) {
      var speed = this.speed * dt;
      
      if (game.distance(this.targetPosition, this.position) <= speed) {
        this.position = this.targetPosition;

        if (this.pathToWalk.length > 0) {
          this.targetTile = this.pathToWalk.splice(0, 1)[0];
          this.targetPosition = game.getCoordsFromTile(this.targetTile);
        } else {
          this.targetTile = null;
          this.targetPosition = null;
          this.pathToWalk = null;
  
          if (this.onReachTarget) {
            this.onReachTarget(this);
          }
        }
      } else {
        var distX = this.targetPosition.x - this.position.x;
        var distY = this.targetPosition.y - this.position.y;
        
        if (distX <= -speed) {
          this.setDirection('left');
          this.position.x -= speed;
        } else if (distX >= speed) {
          this.setDirection('right');
          this.position.x += speed;
        } else {
          if (this.position.x !== this.targetPosition.x) {
            this.position.x = this.targetPosition.x;
          }
            
          if (distY <= -speed) {
            this.setDirection('top');
            this.position.y -= speed;
          } else if (distY >= speed) {
            this.setDirection('bottom');
            this.position.y += speed;
          }
        }
        
        this.tile = game.getTileFromCoords(this.position);
        this.layer.sortActors();
      }
    }
    
    this.drawPosition = game.getOffsetPosition(this.position);
    
    var modules = this.modules;
    for (var i = 0, len = modules.length; i < len; i++) {
      var module = modules[i];
      module.update && module.update(dt);
    }
    
    this.game.endBenchmark('update', this.id);
    
    return true;
  };
  
  Actor.prototype.draw = function draw() {
    var game = this.game;

    game.startBenchmark('draw', this.id);

    var modules = this.modules;
    for (var i = 0, len = modules.length; i < len; i++) {
      var module = modules[i];
      module.draw && module.draw();
    }
    
    game.endBenchmark('draw', this.id);
    

    if (window.DEBUG) {
      var context = this.layer.context;
      
      context.beginPath();
      context.fillStyle = 'rgba(255, 0, 0, .6)';
      context.strokeStyle = 'rgba(255, 0, 0, .6)';
      context.arc(this.drawPosition.x, this.drawPosition.y, 2, 0, Math.PI * 2);
      context.fill();
    
      if (this.pathToWalk) {
        context.fillStyle = 'rgba(0, 0, 255, 1)';
        context.beginPath();
        
        var size = this.game.config.tileSize;
        var camera = this.game.camera;
        
        for (var i = 0, len = this.pathToWalk.length; i < len; i++) {
          var pathX = this.pathToWalk[i].x * size - camera.x;
          var pathY = this.pathToWalk[i].y * size - camera.y;
          context.moveTo(pathX + size / 2, pathY + size / 2);
          context.arc(pathX + size / 2, pathY + size / 2, 5, 0, Math.PI * 2);
        }
        
        context.fill();
      }
    }
    
    return true;
  };
  
  return Actor;
}());
