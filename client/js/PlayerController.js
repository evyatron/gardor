/* Controls a given Actor */
var PlayerController = (function PlayerController() {
  function PlayerController(options) {
    this.game = null;
    this.controlledActor = null;
    
    this.boundToGame = true;
    
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
    
    this.boundToGame = typeof options.boundToGame === 'boolean'? options.boundToGame : true;

    InputManager.bindAction('activate', InputManager.KEYS.SPACE);
    InputManager.bindAction('moveTo', InputManager.KEYS.LEFT_MOUSE_BUTTON);
    
    InputManager.on('pressed', 'moveTo', this.onPointerClick.bind(this));

    InputManager.listenTo(this.game.el);
    
    this.enable();
  };
  
  PlayerController.prototype.setControlledActor = function setControlledActor(actor) {
    this.controlledActor = actor;
  };
  
  PlayerController.prototype.onPointerClick = function onPointerClick(e) {
    if (this.isActive) {
      this.game.handleClick(e);
    }
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
    
    if (this.isActive) {
      this.pointer.x = InputManager.pointerPosition.x + camera.x - game.offset.x;
      this.pointer.y = InputManager.pointerPosition.y + camera.y - game.offset.y;
  
      if (this.boundToGame) {
        var tileSize = game.config.tileSize;
        this.pointer.x = utils.clamp(this.pointer.x, 0, game.width + game.bleed.x - tileSize);
        this.pointer.y = utils.clamp(this.pointer.y, 0, game.height + game.bleed.y - tileSize);
      }
    }
    
    if (window.DEBUG) {
      game.log('pointer: ' + this.pointer.x + ',' + this.pointer.y);
    }
  };
  
  return PlayerController;
}());