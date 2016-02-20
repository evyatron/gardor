/* global Texture */
/* global utils */
/* global Actor */
"use strict";

/*
  Base class for layers - in case we want to separate actors into different layers
  This could help with performance, for example placing all static actors
  In their own layers
*/
var Layer = (function Layer() {
  function Layer(options) {
    this.id = '';
    this.game;
    this.canvas;
    this.context;
    this.width = 0;
    this.height = 0;
    
    this.actors = [];
    this.actorsMap = {};
    
    this.isDirty = false;
    
    this.init(options);
  }
  
  Layer.prototype.init = function init(options) {
    this.id = options.id;
    this.game = options.game;
    
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.canvas.className = 'game-layer';
    this.game.el.appendChild(this.canvas);
    
    this.onResize();
  };
  
  Layer.prototype.setMap = function setMap(map) {
    console.info('[Layer] setMap', this.id, map);
    
    this.actors = [];
    this.actorsMap = {};
    
    for (var i = 0, len = map.actors.length; i < len; i++) {
      this.addActor(map.actors[i]);
    }
    
    this.sortActors();
    
    return true;
  };
  
  Layer.prototype.addActor = function addActor(data) {
    data.layer = this;
    
    var actor = new Actor(data);
    
    this.actors.push(actor);
    this.actorsMap[actor.id] = actor;
    
    return actor;
  };
  
  Layer.prototype.sortActors = function sortActors() {
    this.actors.sort(function actorSorter(a, b) {
      return a.tile.y > b.tile.y? 1 :
             a.tile.y < b.tile.y? -1 :
             a.zIndex > b.zIndex? 1 :
             a.zIndex < b.zIndex? -1 :
             a.id > b.id? 1 :
             a.id < b.id? -1 :
             0;
    });
  };
  
  Layer.prototype.update = function update(dt) {
    var actors = this.actors;
    var didUpdate = false;
    
    for (var i = 0, len = actors.length; i < len; i++) {
      if (actors[i].update(dt)) {
        didUpdate = true;
      }
    }
    
    this.isDirty = didUpdate;

    return true;
  };
  
  Layer.prototype.clear = function clear() {
    this.context.clearRect(0, 0, this.width, this.height);
  };
  
  Layer.prototype.draw = function draw() {
    if (!this.isDirty) {
      return false;
    }
    
    var actors = this.actors;
    for (var i = 0, len = actors.length; i < len; i++) {
      actors[i].draw(this);
    }
    
    return true;
  };
  
  Layer.prototype.onResize = function onResize() {
    this.width = this.game.width;
    this.height = this.game.height;
    
    this.updateSize();
    
    return true;
  };
  
  Layer.prototype.updateSize = function updateSize() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.marginLeft = -this.width / 2 + 'px';
    this.canvas.style.marginTop = -this.height / 2 + 'px';
    
    this.isDirty = true;
    
    return true;
  };
  
  return Layer;
}());

/*
  Game background - this will draw a tileset image from the map grid
  The tileset will be drawn ONCE and then clipped by the camera position
*/
var TilesetLayer = (function TilesetLayer() {
  function TilesetLayer(options) {
    this.texture = null;
    
    Layer.call(this, options);
  }
  
  TilesetLayer.prototype = Object.create(Layer.prototype);
  TilesetLayer.prototype.constructor = TilesetLayer;
  
  TilesetLayer.prototype.init = function init(options) {
    Layer.prototype.init.apply(this, arguments);
    
    this.texture = new Texture({
      'game': this.game,
      'origin': {
        'x': 0,
        'y': 0
      }
    });
  };
  
  TilesetLayer.prototype.setMap = function setMap(map) {
    console.log('Set Tiles: ', map);
    
    this.isDirty = true;
  };
  
  TilesetLayer.prototype.update = function update(dt) {
    if (window.DEBUG_NAVMESH) {
      if (!window.timeSinceUpdatedNavmesh) {
        window.timeSinceUpdatedNavmesh = 0;
      }
      
      window.timeSinceUpdatedNavmesh += dt;
      if (window.timeSinceUpdatedNavmesh >= 1) {
        window.timeSinceUpdatedNavmesh = 0;
        this.isDirty = true;
      }
    }
  };
  
  TilesetLayer.prototype.draw = function draw() {
    if (this.isDirty) {
      this.createTexture();
    }
    
    this.game.startBenchmark('draw', 'grid');
    
    // move the Clip point according to the camera offset and draw the texture
    var camera = this.game.camera;
    var context = this.context;
    
    this.texture.clip = {
      'x': camera.x + this.game.currentMap.padding,
      'y': camera.y + this.game.currentMap.padding
    };
    
    this.texture.draw(context);
  
    if (window.DEBUG) {
      var pointerTile = this.game.getPointerTile();
      
      if (pointerTile) {
        var size = this.game.config.tileSize;
        
        context.fillStyle = 'rgba(255, 255, 255, .3)';
        context.beginPath();
        context.fillRect(pointerTile.x * size - camera.x + this.offset.x,
                         pointerTile.y * size - camera.y + this.offset.y,
                         size, size);
                         
        this.game.log('pointer tile: ' + pointerTile.x + ',' + pointerTile.y);
      }
    }
    
    this.game.endBenchmark('draw', 'grid');

    return true;
  };

  TilesetLayer.prototype.createTexture = function createTexture() {
    var game = this.game;
    var map = game.currentMap;
    var tilesMap = this.game.tiles;
    var size = this.game.config.tileSize;
    var rows = map.grid;
    
    if (!map) {
      console.warn('[TilesetLayer] createTexture: No map loaded');
      return false;
    }
    
    // Make sure all tiles are loaded and ready
    for (var id in tilesMap) {
      var tileObject = tilesMap[id];
      if (!tileObject || !tileObject.texture || !tileObject.texture.isReady) {
        console.warn('[TilesetLayer] createTexture: Not all tiles ready');
        return false;
      }
    }
    
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var tilesDrawn = 0;
    var defaultTile = tilesMap[map.defaultTile];
    var fillTile = tilesMap[map.fillTile];
    var color = map.fillColor;
    var offset = this.offset;
    var padding = map.padding;
    var x, y;
    
    canvas.width = this.texture.width + game.mapWidth + padding * 2;
    canvas.height = this.texture.height + game.mapHeight + padding * 2;
    
    // Fill default colour - 'red' here since it should NEVER be seen
    context.fillStyle = (color && !fillTile)? color : 'red';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Fill default tile
    if (fillTile) {
      var offsetX = -(size - offset.x % size + padding);
      var offsetY = -(size - offset.y % size + padding);
      var width = Math.max(this.width, game.mapWidth) + padding * 2;
      var height = Math.max(this.height, game.mapHeight) + padding * 2;
      
      for (x = offsetX; x < width; x += size) {
        for (y = offsetY; y < height; y += size) {
          if (x < offset.x + padding || x + size > offset.x + game.mapWidth ||
              y < offset.y + padding || y + size > offset.y + game.mapHeight) {
            fillTile.texture.draw(context, x, y);
          }
        }
      }
    }

    for (var i = 0, numberOfRows = rows.length; i < numberOfRows; i++) {
      for (var j = 0, numberOfCols = rows[i].length; j < numberOfCols; j++) {
        var tile = tilesMap[rows[i][j]] || defaultTile;
        
        x = j * size + offset.x + padding;
        y = i * size + offset.y + padding;
        
        if (tile) {
          tile.texture.draw(context, x, y);
          tilesDrawn++;
        }
        
        if (window.DEBUG) {
          if (window.DEBUG_NAVMESH) {
            var navMeshTile = game.navMesh.mesh[i][j];
            
            if (navMeshTile === false) {
              context.fillStyle = 'rgba(255, 0, 0, .3)';
            } else {
              context.fillStyle = 'rgba(0, 255, 0, .2)';
            }
            
            context.fillRect(x + 3, y + 3, size - 6, size - 6);
            
            context.fillStyle = 'rgba(0, 0, 0, 1)';
            context.fillText(navMeshTile, x + 4, y + 21);
          }
    
          context.strokeStyle = 'rgba(255, 0, 0, .2)';
          context.strokeRect(x, y, size, size);
          
          context.fillStyle = 'rgba(0, 0, 0, 1)';
          context.fillText(j + ',' + i, x + 4, y + 12);
        }
      }
    }

    // Assign the canvas directly to the texture to avoid converting it to an image
    this.texture.setImage(canvas);
    
    console.info('Create texture with tiles: ' + tilesDrawn);
    
    this.game.log('create tileset: ' + tilesDrawn + ' tiles');
    
    this.isDirty = false;
  };
  
  TilesetLayer.prototype.onResize = function onResize() {
    var game = this.game;
    this.width = Math.min(game.mapWidth, game.containerWidth);
    this.height = Math.min(game.mapHeight, game.containerHeight);
    
    if (this.texture) {
      this.texture.width = Math.max(game.mapWidth, game.containerWidth);
      this.texture.height = Math.max(game.mapHeight, game.containerHeight);
    }

    this.width = game.containerWidth;
    this.height = game.containerHeight;
    
    this.offset = {
      'x': Math.max((this.width - game.mapWidth) / 2, 0),
      'y': Math.max((this.height - game.mapHeight) / 2, 0)
    };
    
    if (this.texture) {
      this.texture.width = this.width;
      this.texture.height = this.height;
    }
    
    this.updateSize();
  };
  
  return TilesetLayer;
}());

/* HUD layer for all UI (debug, dialogs, tooltips, etc.) */
var HUDLayer = (function HUDLayer() {
  function HUDLayer(options) {
    this.clickTexture = null;
    this.clickPosition = {
      'x': 0,
      'y': 0
    };
    this.timeShownClickTexture = 0;
    this.timeToShowClickTexture = 0;

    this.debugLines = [];
    this.textBoxes = {};
    
    Layer.call(this, options);
  }
  
  HUDLayer.prototype = Object.create(Layer.prototype);
  HUDLayer.prototype.constructor = HUDLayer;
  
  HUDLayer.prototype.POSITION = {
    SCREEN_BOTTOM: 'screen-bottom'
  };

  HUDLayer.prototype.setMap = function setMap(map) {
    var clickTexture = this.game.config.clickTexture;
    
    if (clickTexture) {
      clickTexture.game = this.game;
      this.clickTexture = new Texture(clickTexture);
      this.timeToShowClickTexture = this.game.timeToShowClickTexture;
      this.timeShownClickTexture = this.timeToShowClickTexture;
    }
  };
  
  HUDLayer.prototype.onClick = function onClick(map) {
    var pointer = this.game.playerController.pointer;
    
    this.timeShownClickTexture = 0;
    this.clickPosition.x = pointer.x;
    this.clickPosition.y = pointer.y;
  };
      
  HUDLayer.prototype.update = function update(dt) {
    var game = this.game;
    
    game.startBenchmark('update', 'hud');
    
    if (this.timeShownClickTexture < this.timeToShowClickTexture) {
      this.timeShownClickTexture += dt;
    }

    this.toggleTooltip();

    game.endBenchmark('update', 'hud');
    
    return true;
  };
  
  HUDLayer.prototype.toggleTooltip = function toggleTooltip() {
    var game = this.game;
    var tooltipActor = null;
    
    if (game.playerController.isActive) {
      for (var id in game.actorsUnderPointer) {
        if (game.actorsUnderPointer[id].tooltip) {
          tooltipActor = game.actorsUnderPointer[id];
          break;
        }
      }
    }
    
    if (tooltipActor) {
      this.showTextBox('actors-tooltip', {
        'content': this.formatTooltip(tooltipActor.tooltip),
        'position': tooltipActor.getScreenPosition(),
        'centred': true
      });
    } else {
      this.hideTextBox('actors-tooltip');
    }
  };
  
  HUDLayer.prototype.formatTooltip = function formatTooltip(tooltip) {
    return tooltip;
  };
  
  HUDLayer.prototype.writeDebugLine = function writeDebugLine(text) {
    this.debugLines.push(text);
  };
  
  HUDLayer.prototype.draw = function draw() {
    var context = this.context;
    var game = this.game;
    
    game.startBenchmark('draw', 'hud');
    
    // Click Indiactor
    if (this.timeShownClickTexture < this.timeToShowClickTexture) {
      var position = game.getOffsetPosition(this.clickPosition);
      this.clickTexture.draw(context, position.x, position.y);
    }
    
    game.endBenchmark('draw', 'hud');

    if (window.DEBUG) {
      context.fillStyle = 'rgba(255, 255, 255, 1)';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      
      if (this.game.config.defaultFont) {
        context.font = this.game.config.defaultFont;
      }
      this.textOffset = 0;
      for (var i = 0, len = this.debugLines.length; i < len; i++) {
        this.context.fillText(this.debugLines[i], 5, 5 + this.textOffset);
        this.textOffset += 10;
      }
      this.debugLines = [];
    }
    
    return true;
  };

  HUDLayer.prototype.onResize = function onResize() {
    Layer.prototype.onResize.apply(this, arguments);
    
    var context = this.context;
    context.textBaseline = 'top';
    context.textAlign = 'center';
    context.shadowColor = 'rgba(0, 0, 0, 1)';
    context.shadowBlur = 1;
  };
  
  HUDLayer.prototype.showTextBox = function showTextBox(id, options) {
    !options && (options = {});
    
    var el = this.textBoxes[id];
    var position = options.position || {};
    
    if (!el) {
      el = document.createElement('div');
      el.classList.add('text-box');
      el.classList.add(id);
      
      if (options.classes) {
        for (var i = 0; i < options.classes.length; i++) {
          el.classList.add(options.classes[i]);
        }
      }
      
      this.game.el.appendChild(el);
      
      this.textBoxes[id] = el;
    }
    
    el.innerHTML = options.content;
  
    if (position) {
      if (utils.enumContains(this.POSITION, position)) {
        el.classList.add('position-' + position);
      } else {
        if (options.centred) {
          var bounds = el.getBoundingClientRect();
          position.x = Math.round(position.x - bounds.width / 2);
          position.y = Math.round(position.y + this.game.config.tileSize / 2);
        }
        
        // Round to avoid blurry elements on Chrome (when translating to floating point)
        position.x = Math.round(position.x);
        position.y = Math.round(position.y);
        
        el.style.transform = 'translate(' + position.x + 'px, ' + position.y + 'px)';
      }
    }
      
    el.classList.add('visible');
    
    return el;
  };
  
  HUDLayer.prototype.hideTextBox = function hideTextBox(id) {
    var el = this.textBoxes[id];
    if (el) {
      el.addEventListener('webkitTransitionEnd', function onHide(e) {
        e.target.parentNode.removeChild(e.target);
      });
      
      el.classList.remove('visible');
      this.textBoxes[id] = null;
    }
  };

  return HUDLayer;
}());
