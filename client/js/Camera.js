/* global utils */
"use strict";

/*
  Can be focused on an actor to follow it
  Game drawing will be clipped to centre around the camera position
*/
var Camera = (function Camera() {
  function Camera(options) {
    this.game = null;
    this.actorToFollow = null;
    
    this.lerpAlpha = 1;
    
    this.x = 0;
    this.y = 0;
    this.targetPosition = {
      'x': 0,
      'y': 0
    };
    
    this.init(options);
  }
  
  Camera.prototype.init = function init(options) {
    !options && (options = {});
    
    this.game = options.game;
  };
  
  Camera.prototype.setActorToFollow = function setActorToFollow(actor) {
    this.actorToFollow = actor;
    this.focusOnActor();
  };
  
  Camera.prototype.getActorPosition = function getActorPosition() {
    var game = this.game;
    var actorPosition = this.actorToFollow.position;
    var padding = game.currentMap.padding;
    
    return {
      'x': utils.clamp(-game.width / 2 + actorPosition.x, -padding, game.bleed.x + padding),
      'y': utils.clamp(-game.height / 2 + actorPosition.y, -padding, game.bleed.y + padding)
    };
  };
  
  Camera.prototype.focusOnActor = function focusOnActor() {
    if (this.actorToFollow) {
      var position = this.getActorPosition();
      this.x = position.x;
      this.y = position.y;
    }
  };
  
  Camera.prototype.onResize = function onResize() {
    this.focusOnActor();
  };
  
  Camera.prototype.update = function update(dt) {
    var game = this.game;
    
    if (this.actorToFollow) {
      this.targetPosition = this.getActorPosition();
    }
    
    var distX = this.targetPosition.x - this.x;
    var distY = this.targetPosition.y - this.y;
    
    if (distX) {
      this.x += distX * this.lerpAlpha;
      
      if (Math.abs(distX) < 1) {
        this.x = this.targetPosition.x;
      }
    }
    if (distY) {
      this.y += distY * this.lerpAlpha;
      
      if (Math.abs(distY) < 1) {
        this.y = this.targetPosition.y;
      }
    }
    
    // Round to avoid half-pixel artefacts with tiles not aligning perfectly
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    
    game.log('camera: ' + this.x + ',' + this.y);
  };
  
  Camera.prototype.updateConfigFromGame = function updateConfigFromGame() {
    var config = this.game.config;
    
    this.lerpAlpha = config.lerpAlpha || 1;
  };

  return Camera;
}());
