/* global Texture */
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
    this.game.el.appendChild(this.canvas);
    
    this.onResize();
  };
  
  Layer.prototype.setMap = function setMap(map) {
    console.info('[Layer] setMap', this.id, map);
    
    this.actors = [];
    this.actorsMap = {};
    
    for (var i = 0, len = map.actors.length; i < len; i++) {
      var actorData = map.actors[i];
      actorData.layer = this;
      
      var actor = new Actor(actorData);
      this.actors.push(actor);
      this.actorsMap[actor.id] = actor;
    }
    
    this.sortActors();
    
    return true;
  };
  
  Layer.prototype.sortActors = function sortActors() {
    this.actors.sort(function actorSorter(a, b) {
      return a.tile.y > b.tile.y? 1 :
             a.tile.y < b.tile.y? -1 :
             a.zIndex > b.zIndex? 1 :
             a.zIndex < b.zIndex? -1 :
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
    this.grid = [];
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
    
    this.grid = map.grid;
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
      'x': camera.x,
      'y': camera.y
    };
    
    this.texture.draw(context);
  
    if (window.DEBUG) {
      var pointerTile = this.game.getPointerTile();
      
      if (pointerTile) {
        var size = this.game.config.tileSize;
        
        context.fillStyle = 'rgba(255, 255, 255, .4)';
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
    var rows = this.grid;
    
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

    canvas.width = this.texture.width + game.mapWidth;
    canvas.height = this.texture.height + game.mapHeight;
    
    // Fill default colour
    if (color && !fillTile) {
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Fill default tile
    if (fillTile) {
      var offsetX = -(size - offset.x % size);
      var offsetY = -(size - offset.y % size);
      var width = Math.max(this.width, game.mapWidth) + 0;
      var height = Math.max(this.height, game.mapHeight) + 0;
      
      for (var x = offsetX; x < width; x += size) {
        for (var y = offsetY; y < height; y += size) {
          if (x < offset.x || x + size > offset.x + game.mapWidth ||
              y < offset.y || y + size > offset.y + game.mapHeight) {
            fillTile.texture.draw(context, x, y);
          }
        }
      }
    }

    for (var i = 0, numberOfRows = rows.length; i < numberOfRows; i++) {
      for (var j = 0, numberOfCols = rows[i].length; j < numberOfCols; j++) {
        var tile = tilesMap[rows[i][j]] || defaultTile;
        
        if (tile) {
          var x = j * size + offset.x;
          var y = i * size + offset.y;
          
          tile.texture.draw(context, x, y);
          tilesDrawn++;
          
          if (window.DEBUG) {
            var thisTile = {
              'x': j,
              'y': i
            };
            
            if (window.DEBUG_NAVMESH) {
              if (game.navMesh.isBlocked(thisTile)) {
                context.fillStyle = 'rgba(255, 0, 0, .2)';
              } else {
                context.fillStyle = 'rgba(0, 255, 0, .2)';
              }
              
              context.fillRect(x + 3, y + 3, size - 6, size - 6);
            }
      
            context.strokeStyle = 'rgba(255, 0, 0, .2)';
            context.strokeRect(x, y, size, size);
            
            context.fillStyle = 'rgba(0, 0, 0, 1)';
            context.fillText(j + ',' + i, x + 4, y + 12);
          }
        } else {
          console.warn('Trying to draw invalid tile', rows[i][j], i, j);
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
    
    
    // STRETCH TEST
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
    this.tooltip = {
      'actorId': '',
      'x': 0,
      'y': 0,
      'width': 0,
      'height': 0,
      'text': '',
      'isVisible': false
    };
    
    this.clickTexture = null;
    this.clickPosition = {
      'x': 0,
      'y': 0
    };
    this.timeShownClickTexture = 0;
    this.timeToShowClickTexture = 0;
    
    this.debugLines = [];
    
    Layer.call(this, options);
  }
  
  HUDLayer.prototype = Object.create(Layer.prototype);
  HUDLayer.prototype.constructor = HUDLayer;
  
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

    var actorUnderPointer = null;
    if (game.playerController.isActive) {
      for (var id in game.actorsUnderPointer) {
        if (game.actorsUnderPointer[id].tooltip) {
          actorUnderPointer = game.actorsUnderPointer[id];
          break;
        }
      }
    }
    
    var tooltip = this.tooltip;
    if (!actorUnderPointer) {
      tooltip.actorId = '';
      tooltip.isVisible = false;
    } else {
      if (tooltip.actorId !== actorUnderPointer.id) {
        tooltip.actorId = actorUnderPointer.id;
        tooltip.text = actorUnderPointer.tooltip;
        tooltip.isVisible = true;
      }
      
      var offsetPosition = this.game.getOffsetPosition(actorUnderPointer.position);
      tooltip.x = offsetPosition.x;
      tooltip.y = offsetPosition.y + game.config.tileSize / 2;
    }
    
    game.endBenchmark('update', 'hud');
    
    return true;
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
    
    // Tooltip
    var tooltip = this.tooltip;
    if (tooltip.isVisible) {
      var tooltipConfig = game.config.tooltips || {};
      var padding = tooltipConfig.padding || {'x': 0, 'y': 0};
      var textSize = game.measureText(context, tooltip.text, tooltipConfig.lineSpacing); 

      tooltip.width = textSize.width;
      tooltip.height = textSize.height;
      
      context.textBaseline = 'middle';
      context.textAlign = 'center';
      context.fillStyle = 'rgba(0, 0, 0, .75)';
      context.strokeStyle = 'rgba(0, 0, 0, 1)';
      if (tooltipConfig.font) {
        context.font = tooltipConfig.font;
      }
      
      context.fillRect(tooltip.x - padding.x - tooltip.width / 2,
                       tooltip.y - padding.y * 1.5,
                       tooltip.width + padding.x * 2,
                       tooltip.height + padding.y * 2);
                       
      context.strokeRect(tooltip.x - padding.x - tooltip.width / 2,
                       tooltip.y - padding.y * 1.5,
                       tooltip.width + padding.x * 2,
                       tooltip.height + padding.y * 2);

      context.fillStyle = 'rgba(255, 255, 255, 1)';
      game.drawText(context,
                    tooltip.text,
                    tooltip.x,
                    tooltip.y + padding.y,
                    context.font,
                    tooltipConfig.lineSpacing);
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
    
    var font = (this.game.config.tooltips || {}).font;
    
    var context = this.context;
    context.textBaseline = 'top';
    context.textAlign = 'center';
    context.shadowColor = 'rgba(0, 0, 0, 1)';
    context.shadowBlur = 1;
    
    if (font) {
      context.font = font;
    }
  };
  return HUDLayer;
}());
