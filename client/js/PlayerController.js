/* global InputManager */
/* global utils */
/* Controls a given Actor */
"use strict";

var PlayerController = (function PlayerController() {
  function PlayerController(options) {
    this.game = null;
    this.controlledActor = null;
    
    this.pointer = {
      'x': 0,
      'y': 0
    };
    
    this.justPressed = {};
    
    this.pathToWalk = null;
    this.timeoutMove = null;
    
    this.isActive = true;
    
    this.init(options);
  }
  
  PlayerController.prototype.init = function init(options) {
    this.game = options.game;

    InputManager.bindAction('interact', InputManager.KEYS.LEFT_MOUSE_BUTTON);
    InputManager.bindAction('secondary', InputManager.KEYS.RIGHT_MOUSE_BUTTON);
    InputManager.bindAction('up', [InputManager.KEYS.W, InputManager.KEYS.UP]);
    InputManager.bindAction('left', [InputManager.KEYS.A, InputManager.KEYS.LEFT]);
    InputManager.bindAction('down', [InputManager.KEYS.S, InputManager.KEYS.DOWN]);
    InputManager.bindAction('right', [InputManager.KEYS.D, InputManager.KEYS.RIGHT]);
    
    InputManager.on('pressed', 'interact', this.game.handlePrimaryAction.bind(this.game));
    InputManager.on('pressed', 'secondary', this.game.handleSecondaryAction.bind(this.game));

    InputManager.listenTo(this.game.el);
    
    this.enable();
  };
  
  PlayerController.prototype.setControlledActor = function setControlledActor(actor) {
    this.controlledActor = actor;
  };
  
  PlayerController.prototype.getActor = function getActor() {
    return this.controlledActor;
  };
  
  PlayerController.prototype.enable = function enable() {
    this.isActive = true;
  };
  
  PlayerController.prototype.disable = function disable() {
    this.isActive = false;
  };
  
  PlayerController.prototype.moveTo = function moveTo(position, onReach) {
    var actor = this.controlledActor;
    if (actor) {
      actor.moveTo(position, onReach);
    }
  };
  
  PlayerController.prototype.wasJustPressed = function wasJustPressed(key) {
    return !!this.justPressed[key];
  };
  
  PlayerController.prototype.update = function update(dt) {
    var game = this.game;
    var camera = this.game.camera;
    
    this.justPressed = InputManager.justPressed;
    InputManager.justPressed = {};

    this.pointer.x = InputManager.pointerPosition.x - game.offset.x + camera.x;
    this.pointer.y = InputManager.pointerPosition.y - game.offset.y + camera.y;
    
    if (this.isActive) {
      var actor = this.controlledActor;
      if (actor) {
        var dir = {
          'x': 0,
          'y': 0
        };
        
        if (InputManager.actionsActive.up) {
          dir.y--;
        }
        if (InputManager.actionsActive.down) {
          dir.y++;
        }
        if (dir.y === 0) {
          if (InputManager.actionsActive.left) {
            dir.x--;
          }
          if (InputManager.actionsActive.right) {
            dir.x++;
          }
        }
        
        actor.moveOnVector(dir);
      }
    }
    
    game.log('pointer: ' + this.pointer.x + ',' + this.pointer.y);
  };
  
  return PlayerController;
}());