/* global EventDispatcher */
"use strict";

/* Used to draw an image on screen */
var Texture = (function Texture() {
  function Texture(options, onLoad) {
    this.game = null;
    this.src = '';
    this.origin = {
      'x': 0.5,
      'y': 0.5
    };
    this.drawOrigin = {
      'x': 0.5,
      'y': 0.5
    };
    this.clip = {
      'x': 0,
      'y': 0
    };
    
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.alpha = null;
    this.animations = null;
    this.isReady = false;
    
    this.animationTime = 0;
    this.currentAnimationId = '';
    this.currentAnimation = null;
    
    this.init(options, onLoad);
  }
  
  Texture.prototype = Object.create(EventDispatcher.prototype);
  Texture.prototype.constructor = Texture;
  
  // Save a map of src=>image, to not load same image multiple times
  Texture.prototype.textures = {};
  
  Texture.prototype.init = function init(options) {
    this.game = options.game;
    
    this.setData(options);
  };
  
  Texture.prototype.setImage = function setImage(image) {
    if (image) {
      this.src = Date.now() + '_' + Math.random();
      image.isReady = true;
      Texture.prototype.textures[this.src] = image;
      
      this.onLoad();
    } else {
      this.src = '';
    }
  };
  
  Texture.prototype.setClip = function setClip(clip) {
    this.clip = clip || {
      'x': 0,
      'y': 0
    };
  };
  
  Texture.prototype.setAlpha = function setAlpha(alpha) {
    if (alpha === undefined) {
      alpha = null;
    }
    
    this.alpha = alpha;
  };
  
  Texture.prototype.setDirectionAnimation = function setDirectionAnimation(direction) {
    this.setAnimation('_' + direction);
  };
  
  Texture.prototype.setAnimation = function setAnimation(animationId) {
    var animation = this.animations && this.animations[animationId];
    
    if (animationId !== this.currentAnimationId) {
      this.animationTime = 0;
    }
    
    this.currentAnimationId = animationId;
    this.currentAnimation = animation;
  };
  
  Texture.prototype.stopAnimation = function stopAnimation() {
    this.currentAnimation = null;
  };
  
  Texture.prototype.getImage = function getImage() {
    return Texture.prototype.textures[this.src];
  };
  
  Texture.prototype.setData = function setData(data) {
    this.src = data.src;
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.origin = data.origin || {
      'x': 0.5,
      'y': 0.5
    };
    this.clip = data.clip || {
      'x': 0,
      'y': 0
    };
    this.scale = data.scale || 1;
    this.animations = data.animations || null;
    
    if (this.animations) {
      this.setAnimation('_top');
    }

    if (this.src) {
      this.isReady = false;
      
      var image = Texture.prototype.textures[this.src];
      if (image) {
        if (image.isReady) {
          this.isReady = true;
          this.onLoad();
        } else {
          image.addEventListener('load', this.onLoad.bind(this));
        }
      } else {
        var src = this.src;
        if (this.game) {
          src = this.game.getAssetPath(src, this.game.ASSET_TYPE.IMAGE);
        }
        
        image = new Image();
        image.addEventListener('load', this.onLoad.bind(this));
        image.addEventListener('error', this.onError.bind(this));
        image.src = src;

        Texture.prototype.textures[this.src] = image;
      }
    }
  };
  
  Texture.prototype.update = function update(dt) {
    if (this.currentAnimation) {
      this.animationTime += dt;
    }
  };
  
  Texture.prototype.draw = function draw(context, x, y, gameBounds) {
    var src = this.src;
    if (!src) {
      return false;
    }
    
    var image = Texture.prototype.textures[src];
    
    if (!image.isReady) {
      return false;
    }
    
    var origin = this.drawOrigin;
    var clip = this.clip;
    var width = this.width;
    var height = this.height;
    var scale = this.scale;
    var drawWidth = width * scale;
    var drawHeight = height * scale;
    var shouldDraw = true;

    x = (x || 0) - origin.x * scale;
    y = (y || 0) - origin.y * scale;
    
    if (gameBounds) {
      if (x + drawWidth < 0 || x > gameBounds.width ||
          y + drawHeight < 0 || y > gameBounds.height) {
        shouldDraw = false;
      }
    }
    
    if (shouldDraw) {
      var previousAlpha = null;
      if (this.alpha !== null) {
        previousAlpha = context.globalAlpha;
        context.globalAlpha = this.alpha;
      }
      
      var originX = clip.x;
      var originY = clip.y;
      
      if (this.currentAnimation) {
        var animation = this.currentAnimation;
        var frame = Math.floor(this.animationTime / animation.speed) % animation.numberOfFrames;
        originX = animation.start.x + frame * width;
        originY = animation.start.y;
      }
      
      context.drawImage(image,
                        // Draw this
                        originX,
                        originY,
                        width,
                        height,
                        // Here
                        x,
                        y,
                        drawWidth,
                        drawHeight);
      
      if (previousAlpha !== null) {
        context.globalAlpha = previousAlpha;
      }
      
      if (window.DEBUG && this.game) {
        this.game.stats.textures++;
      }
    }
    
    return true;
  };
  
  Texture.prototype.onLoad = function onLoad() {
    var image = Texture.prototype.textures[this.src];

    this.isReady = true;
    image.isReady = true;
    
    if (!this.width) {
      this.width = image.width;
    }
    if (!this.height) {
      this.height = image.height;
    }

    this.drawOrigin.x = this.width * this.origin.x;
    this.drawOrigin.y = this.height * this.origin.y;
    
    this.dispatch('load');
  };
  
  Texture.prototype.onError = function onError() {
    console.error('Error trying to load texture', this);
  };
  
  return Texture;
}());
