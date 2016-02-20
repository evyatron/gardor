/* global Game */
(function main() {
  var game = null;
  var MENU_CLICK_TIME_DIALTION = 3;
  
  function init() {
    game = new Game({
      'el': document.getElementById('game'),
      'configDir': '/game',
      'autoGoToMap': true
    });
    
    window.game = game;
    
    game.on(game.EVENTS.MAP_CREATE, onStartedPlaying);
    
    document.querySelector('.menu').addEventListener('click', onMenuClick);
  }
  
  function onStartedPlaying() {
    var playerActor = game.playerController.controlledActor;
    if (playerActor) {
      playerActor.on(playerActor.EVENTS.REACH_TARGET, onPlayerReachTarget);
    }
  }
  
  function onPlayerReachTarget() {
    game.timeDialation = 1;
    game.playerController.enable();
  }
  
  function onMenuClick(e) {
    var el = e.target;
    var target = (el.dataset || {}).target;
    
    if (target) {
      var targetActor = game.getActor(target);
      
      if (targetActor) {
        e.preventDefault();
        game.timeDialation = MENU_CLICK_TIME_DIALTION;
        game.playerController.disable();
        targetActor.onClick(e);
      } else {
        console.warn('No actor found for: ', target);
      }
    }
  }
  
  init();
}());