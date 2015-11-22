(function() {
  var editor;
  
  function init() {
    editor = new Editor({
      'game': window.game
    });
  }

  function Editor(options) {
    this.game = null;
    
    this.init(options);
  }
  
  Editor.prototype.init = function init(options) {
    this.game = options.game;
    
    this.game.on('mapCreated', this.onMapCreated.bind(this));
    
    console.info('[Editor] init');
    
    if (this.game.isReady) {
      this.onGameCreated(this.game);
    } else {
      this.game.on('created', this.onGameCreated.bind(this));
    }
  };
  
  Editor.prototype.onGameCreated = function onGameCreated(game) {
    console.info('[Editor] Game created');
  };
  
  Editor.prototype.onMapCreated = function onMapCreated(game) {
    console.info('[Editor] Game map ready');
  };
  
  init();
}());