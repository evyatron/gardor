/* global Texture */
/* global utils */
/* global InputManager */
"use strict";

/*
  Base class for all modules that can be attached to actors
  Nothing should use the ActorModule directly, but rather inherited classes
*/
var ActorModule = (function ActorModule() {
  function ActorModule(options) {
    this.type = '';
    this.actor = null;
    this.isActive = false;
    this.disableController = false;
    this.activation = '';
    this.useDir = '';
    this.useOffset = {
      'x': 0,
      'y': 0
    };
    
    this.init(options);
  }
  
  ActorModule.prototype.ACTIVATIONS = {
    AUTOMATIC: 'auto',
    INTERACT: 'interact',
    MANUAL: 'manual',
    PROXIMITY: 'proximity'
  };
  
  ActorModule.prototype.init = function init(options) {
    this.type = options.type;
    this.actor = options.actor;
    this.activation = options.activation;
    this.disableController = Boolean(options.disableController);
    this.useDir = options.useDir || '';
    this.useOffset = options.useOffset || {
      'x': 0,
      'y': 0
    };
    
    if (!this.useDir) {
      if (this.useOffset.x < 0) {
        this.useDir = 'right';
      } else if (this.useOffset.x > 0) {
        this.useDir = 'left';
      } else if (this.useOffset.y < 0) {
        this.useDir = 'bottom';
      } else if (this.useOffset.y > 0) {
        this.useDir = 'top';
      }
    }
    
    switch (this.activation) {
      case ActorModule.prototype.ACTIVATIONS.AUTOMATIC:
        this.activate();
        break;
      case ActorModule.prototype.ACTIVATIONS.INTERACT:
        this.onClick = this.onClick_inactive;
        break;
      case ActorModule.prototype.ACTIVATIONS.MANUAL:
        break;
      case ActorModule.prototype.ACTIVATIONS.PROXIMITY:
        break;
    }
  };
  
  ActorModule.prototype.onClick_inactive = function onClick(e) {
    var game = this.actor.game;
    var goToTile = {
      'x': this.actor.tile.x + this.useOffset.x,
      'y': this.actor.tile.y + this.useOffset.y
    };
    
    game.playerController.moveTo(goToTile, this.activate.bind(this));
    
    return true;
  };
  
  ActorModule.prototype.stop = function stop() {
    this.isActive = false;
    
    if (this.disableController) {
      this.actor.game.playerController.enable();
    }
    
    if (this.draw) {
      this.drawMethod = this.draw;
      delete this.draw;
    }
    
    if (this.update) {
      this.updateMethod = this.update;
      delete this.update;
    }
  };
  
  ActorModule.prototype.activate = function activate() {
    this.isActive = true;
    
    if (this.disableController) {
      this.actor.game.playerController.disable();
    }
    
    if (this.drawMethod) {
      this.draw = this.drawMethod;
    }
    if (this.updateMethod) {
      this.update = this.updateMethod;
    }
    
    if (this.useDir) {
      var player = this.actor.game.playerController.controlledActor;
      if (player) {
        player.setDirection(this.useDir);
      }
    }
  };

  return ActorModule;
}());

/*
  Basic Texture module to draw the actor's texture
  Since this is a module it's possible to use several textures for each actor
*/
var ModuleTexture = (function ModuleTexture() {
  function ModuleTexture(options) {
    this.texture = null;
    this.dirClips = {};
    this.actorDirection = '';
    
    utils.setDefaults(options, {
      'activation': ActorModule.prototype.ACTIVATIONS.AUTOMATIC
    });
    
    this.init(options);
  }
  
  ModuleTexture.prototype = Object.create(ActorModule.prototype);
  ModuleTexture.prototype.constructor = ModuleTexture;
  
  ModuleTexture.prototype.init = function init(options) {
    ActorModule.prototype.init.apply(this, arguments);

    this.dirClips = options.dirClips || {};
    options.game = this.actor.game;
    this.texture = new Texture(options);
  };
  
  ModuleTexture.prototype.drawMethod = function draw() {
    var actor = this.actor;
    var game = actor.game;
    var drawPosition = game.getOffsetPosition(actor.position);
    
    if (actor.direction !== this.actorDirection) {
      this.actorDirection = actor.direction;
      
      var clip = this.dirClips[this.actorDirection];
      if (clip) {
        this.texture.setClip(clip);
      }
    }
    
    this.texture.draw(actor.layer.context,
                      drawPosition.x,
                      drawPosition.y,
                      game);
  };

  return ModuleTexture;
}());

/* Shows a UI dialog. INTERACT by default */
var ModuleDialog = (function ModuleDialog() {
  function ModuleDialog(options) {
    this.dialogId = '';
    this.dialog = null;
    this.lines = [];
    this.startingLineId = '';
    this.currentLineIndex = 0;
    this.texture = null;
    this.nextLine_bound = null;
    
    this.font = '';
    this.width = 0;
    this.height = 0;
    this.padding = 0;
    this.actorImageSize = 0;
    
    utils.setDefaults(options, {
      'activation': ActorModule.prototype.ACTIVATIONS.INTERACT,
      'disableController': true
    });
    
    ActorModule.call(this, options);
  }
  
  ModuleDialog.prototype = Object.create(ActorModule.prototype);
  ModuleDialog.prototype.constructor = ModuleDialog;
  
  ModuleDialog.prototype.init = function init(options) {
    ActorModule.prototype.init.apply(this, arguments);
    
    this.dialogId = options.dialogId;
    this.dialog = this.actor.game.getDialog(this.dialogId);
    
    this.texture = new Texture({
      'game': this.actor.game,
      'origin': {
        'x': 0,
        'y': 0
      }
    });
    
    this.nextLine_bound = this.nextLine.bind(this);
    
    if (this.dialog) {
      this.lines = this.dialog.lines;
      this.startingLineId = this.dialog.startingLine || this.lines[0].id;
    } else {
      this.dialog = {};
      console.warn('Cant find requested dialog', this);
    }
  };
  
  ModuleDialog.prototype.activate = function activate(e) {
    ActorModule.prototype.activate.apply(this, arguments);
    
    console.log('[Dialog] Activate', this);
    
    this.currentLineIndex = -1;
    this.texture.setImage(null);
    this.nextLine();
    
    InputManager.on('pressed', 'interact', this.nextLine_bound);
  };
  
  ModuleDialog.prototype.stop = function stop(e) {
    ActorModule.prototype.stop.apply(this, arguments);
    console.warn('stop and hide')
    this.currentLineIndex = -1;
    this.currentLine = null;
    this.currentActor = null;
    this.actor.game.getHUD().hideTextBox('dialog-box');
    
    InputManager.off('pressed', 'interact', this.nextLine_bound);
  };
  
  ModuleDialog.prototype.nextLine = function nextLine() {
    console.warn('next line')
    
    var newIndex = this.currentLineIndex + 1;
    if (newIndex === 0) {
      newIndex = this.getLineIndexById(this.startingLineId);
    } else {
      var line = this.lines[this.currentLineIndex];
      if ('nextLine' in line) {
        newIndex = this.getLineIndexById(line.nextLine);
      }
    }
    
    if (newIndex < this.lines.length) {
      var hud = this.actor.game.getHUD();
      this.currentLineIndex = newIndex;
      this.currentLine = this.lines[this.currentLineIndex];
      this.currentActor = this.getLineActor(this.currentLine);
      
      var texture = this.currentActor.getTexture();
      var avatarImage = null;
      if (texture) {
        avatarImage = texture.getImage();
      }
      
      hud.showTextBox('dialog-box', {
        'content': '<div class="image" style="background-image: url(\'\')"></div>' +
                   '<div class="content">' + this.currentLine.text + '</div>',
        'position': hud.POSITION.SCREEN_BOTTOM
      });
    } else {
      this.stop();
    }
  };

  ModuleDialog.prototype.getLineIndexById = function getLineIndexById(id) {
    var lines = this.lines;
    var index = -1;
    
    for (var i = 0, len = lines.length; i < len; i++) {
      if (lines[i].id === id) {
        index = i;
        break;
      }
    }
    
    return index;
  };
  
  ModuleDialog.prototype.getLineActor = function getLineActor(line) {
    var actorId = line.actor;
    var actor = null;
    
    if (actorId === 'PC') {
      actor = this.actor.game.playerController.controlledActor;
    } else if (actorId === 'NPC') {
      actor = this.actor;
    } else {
      actor = this.actor.game.getActor(actorId);
    }
    
    return actor;
  };
  
  return ModuleDialog;
}());

/* Shows a webpage either in a frame or a new tab. INTERACT by default */
var ModuleWebPage = (function ModuleWebPage() {
  var TEMPLATE_POPUP = '<div class="popup-block-content">' +
                         '<div class="popup-block-title">Popup Blocked?? Noooooooo!</div>' +
                         '<div class="popup-block-message">' +
                            'Please allow popups to fully enjoy<br />' +
                            'the wonder that is this link.' +
                         '</div>' +
                         '<div class="popup-block-buttons">' +
                           '<div class="button">Okay</div>' +
                         '</div>' +
                       '</div>';
  
  function ModuleWebPage(options) {
    this.url = '';
    this.isInFrame = false;
    this.scale = 1;
    this.minWidth = 0;
    this.minHeight = 0;
    
    this.elPopupMessage = null;

    utils.setDefaults(options, {
      'activation': ActorModule.prototype.ACTIVATIONS.INTERACT,
      'disableController': options.isInFrame
    });
    
    ActorModule.call(this, options);
  }
  
  ModuleWebPage.prototype = Object.create(ActorModule.prototype);
  ModuleWebPage.prototype.constructor = ModuleWebPage;
  
  ModuleWebPage.prototype.init = function init(options) {
    ActorModule.prototype.init.apply(this, arguments);
    
    this.url = options.url || '';
    this.isInFrame = options.hasOwnProperty('isInFrame')? options.isInFrame : false;
    this.scale = options.scale || 0.95;
    this.minWidth = options.minWidth || 1600;
    this.minHeight = options.minHeight || 900;
  };
  
  ModuleWebPage.prototype.isDocSizeEnough = function isDocSizeEnough() {
    var width = this.actor.game.el.offsetWidth;
    var height = this.actor.game.el.offsetHeight;
    
    return width >= this.minWidth && height >= this.minHeight;
  };
  
  ModuleWebPage.prototype.showPopupMessage = function showPopupMessage() {
    this.elPopupMessage = document.createElement('div');
    this.elPopupMessage.className = 'popup-block';
    this.elPopupMessage.innerHTML = TEMPLATE_POPUP;
    document.body.appendChild(this.elPopupMessage);
    
    this.actor.game.playerController.disable();
    
    var self = this;
    this.elPopupMessage.addEventListener('click', function onClick(e) {
      if (e.target.classList.contains('button')) {
        self.elPopupMessage.removeEventListener('click', onClick);
        self.hidePopupMessage();
      }
    });
  };
  
  ModuleWebPage.prototype.hidePopupMessage = function hidePopupMessage() {
    if (this.elPopupMessage && this.elPopupMessage.parentNode) {
      this.elPopupMessage.parentNode.removeChild(this.elPopupMessage);
    }
    this.actor.game.playerController.enable();
  };
  
  ModuleWebPage.prototype.activate = function activate(e) {
    ActorModule.prototype.activate.apply(this, arguments);
    
    if (this.isInFrame && this.isDocSizeEnough()) {
      var actor = this.actor;
      var parentEl = actor.game.el;
      var width = parentEl.offsetWidth * this.scale;
      var height = parentEl.offsetHeight * this.scale;
      
      this.frame = document.createElement('iframe');
      this.frame.className = 'game-webpage-frame';
      this.frame.style.width = width + 'px';
      this.frame.style.height = height + 'px';
      
      parentEl.appendChild(this.frame);
      
      this.frame.src = this.url;
    } else {
      var windowOpened = window.open(this.url, '_blank');
      if (!windowOpened) {
        this.showPopupMessage();
      }
    }
  };
  
  return ModuleWebPage;
}());

/* Shows an HTML element. INTERACT by default */
var ModuleHTMLElement = (function ModuleHTMLElement() {
  function ModuleHTMLElement(options) {
    this.page = '';
    this.el = null;
    
    utils.setDefaults(options, {
      'activation': ActorModule.prototype.ACTIVATIONS.INTERACT,
      'disableController': true
    });
    
    ActorModule.call(this, options);
  }
  
  ModuleHTMLElement.prototype = Object.create(ActorModule.prototype);
  ModuleHTMLElement.prototype.constructor = ModuleHTMLElement;
  
  ModuleHTMLElement.prototype.init = function init(options) {
    ActorModule.prototype.init.apply(this, arguments);
    
    this.page = options.page;
    
    if (!this.page) {
      console.warn('Trying to create an HTML module without a page!', this);
      return;
    }
    
    var game = this.actor.game;
    var httpRequest = new XMLHttpRequest();
    
    httpRequest.open('GET', game.getAssetPath(this.page, game.ASSET_TYPE.PAGE), true);
    httpRequest.onload = this.onGotPageContent.bind(this);
    httpRequest.send();
  };
  
  ModuleHTMLElement.prototype.onGotPageContent = function onGotPageContent(e) {
    this.createHTML(e.target.response);
  };
  
  ModuleHTMLElement.prototype.createHTML = function createHTML(html) {
    this.el = document.createElement('div');
    this.el.className = 'game-module game-module-' + this.page;
    
    this.el.innerHTML = '<div class="game-module-content text-box">' +
                          html +
                          '<b class="close-html-module text-box"></b>' +
                        '</div>';
                        
    document.body.appendChild(this.el);
    
    var elClose = this.el.querySelector('.close-html-module');
    elClose.addEventListener('click', this.stop.bind(this));
  };
  
  ModuleHTMLElement.prototype.activate = function activate(e) {
    ActorModule.prototype.activate.apply(this, arguments);
    
    if (this.el) {
      this.el.classList.add('visible');
    }
  };
  
  ModuleHTMLElement.prototype.stop = function stop(e) {
    ActorModule.prototype.stop.apply(this, arguments);
    
    if (this.el) {
      this.el.classList.remove('visible');
    }
  };
  
  return ModuleHTMLElement;
}());

/* Spawn particles. AUTOMATIC by default */
var ModuleParticles = (function ModuleParticles() {
  function ModuleParticles(options) {
    this.offset = null;
    
    utils.setDefaults(options, {
      'activation': ActorModule.prototype.ACTIVATIONS.AUTOMATIC
    });
    
    ActorModule.call(this, options);
  }
  
  ModuleParticles.prototype = Object.create(ActorModule.prototype);
  ModuleParticles.prototype.constructor = ModuleParticles;
  
  ModuleParticles.prototype.init = function init(options) {
    ActorModule.prototype.init.apply(this, arguments);
    
    !options && (options = {});
    
    this.offset = options.offset || {
      'x': 0,
      'y': 0
    };

    options.context = this.actor.layer.context;
    options.position = {
      'x': this.actor.drawPosition.x,
      'y': this.actor.drawPosition.y
    };
    
    this.particles = new Particles(options);
    this.particles.isGenerating = true;
    this.particles.isRunning = true;
  };
  
  ModuleParticles.prototype.updateMethod = function updateMethod(dt) {
    this.particles.position.x = this.actor.drawPosition.x + this.offset.x;
    this.particles.position.y = this.actor.drawPosition.y + this.offset.y;
    this.particles.update(dt);
  };
  
  ModuleParticles.prototype.drawMethod = function drawMethod() {
    this.particles.draw(this.actor.layer.context);
  };
  
  var Particles = (function Particles() {
    function Particles(options) {
      this.canvas;
      this.context;

      this.speed;
      this.size;
      this.angle;
      this.position;
      this.lifetime;
      this.frequency;
      this.gravity;
      this.colours = [];

      this.timeUntilNext = 0;
      this.numberOfParticles = 0;
      this.particles = {};

      this.didCreateCanvas = false;
      this.isGenerating = false;
      this.isRunning = false;
      this.lastUpdate = 0;
      this.dt;

      this.onDestroy;
      this.onStop;

      this.colourPresets = {
        'grayscale': ['#888', '#999', '#aaa', '#bbb', '#ccc', '#ddd'],
        'fire': ['#fa0', '#ff0', '#f00'],
      };

      this.init(options);
    }

    Particles.prototype = Object.create(EventDispatcher.prototype);
    Particles.prototype.constructor = Particles;

    Particles.prototype.init = function init(options) {
      !options && (options = {});
      
      this.setAngle(options.angle);
      this.setFrequency(options.frequency);
      this.setGravity(options.gravity);
      this.setSpeed(options.speed);
      this.setLifetime(options.lifetime);
      this.setSize(options.size);
      
      this.setPosition(options.position);
      this.setColours(options.colours);

      this.onDestroy = options.onDestroy || function(){};
      this.onStop = options.onStop || function(){};

      if (options.canvas) {
        this.canvas = options.canvas;
      } else if (options.context) {
        this.canvas = options.context.canvas;
      } else {
        this.didCreateCanvas = true;
        this.canvas = document.createElement('canvas');
      }

      if (this.canvas) {
        this.context = this.canvas.getContext('2d');
      }
    };

    Particles.prototype.addColourPreset = function addColourPreset(name, colours) {
      this.colourPresets[name] = colours;
      return this;
    };

    Particles.prototype.setAngle = function setAngle(angle) {
      this.angle = angle !== undefined? angle : [-35, 35];
      return this;
    };

    Particles.prototype.setGravity = function setGravity(gravity) {
      this.gravity = gravity !== undefined? gravity : [0.5, 1.5];
      return this;
    };

    Particles.prototype.setFrequency = function setFrequency(frequency) {
      this.frequency = frequency !== undefined? frequency: 0;
      return this;
    };

    Particles.prototype.setSpeed = function setSpeed(speed) {
      this.speed = speed !== undefined? speed: utils.random(200, 400);
      return this;
    };

    Particles.prototype.setPosition = function setPosition(position) {
      if (typeof arguments[0] === 'number' && typeof arguments[1] === 'number') {
        position = {
          'x': arguments[0],
          'y': arguments[1]
        };
      }
      
      if (!position) {
        position = {};
      }

      this.position = {
        'x': position.x || 0,
        'y': position.y || 0
      };

      return this;
    };

    Particles.prototype.setLifetime = function setLifetime(lifetime) {
      this.lifetime = lifetime !== undefined? lifetime: 0;
      return this;
    };

    Particles.prototype.setSize = function setSize(size) {
      this.size = size;
      return this;
    };

    Particles.prototype.setColours = function setColours(colours) {
      this.colours = [];

      if (!colours) {
        colours = 'rgb(255, 0, 0)';
      }

      if (typeof colours === 'string') {
        if (this.colourPresets[colours]) {
          colours = this.colourPresets[colours];
        } else {
          colours = [colours];
        }
      }

      if (typeof colours === 'number') {
        for (var i = 0; i < colours; i++) {
          var r = Math.round(utils.random(0, 255));
          var g = Math.round(utils.random(0, 255));
          var b = Math.round(utils.random(0, 255));
          this.colours.push('rgb(' + r + ',' + g + ',' + b + ')');
        }
      } else if (Array.isArray(colours)) {
        for (var i = 0; i < colours.length; i++) {
          this.colours.push(colours[i]);
        }
      }

      return this;
    };

    Particles.prototype.start = function start(setNumber) {
      this.timeUntilNext = 0;

      if (setNumber) {
        for (var i = 0; i < setNumber; i++) {
          this.createNew();
        }
      } else {
        this.isGenerating = true;
      }

      this.isRunning = true;

      return this;
    };

    Particles.prototype.stop = function stop() {
      if (this.isRunning) {
        this.isGenerating = false;
        this.isRunning = false;
        this.onStop();
      }

      return this;
    };

    Particles.prototype.destroy = function destroy() {
      this.stop();

      if (this.didCreateCanvas) {
        if (this.canvas.parentNode) {
          this.canvas.parentNode.removeChild(this.canvas);
        }
      }

      this.onDestroy();

      return this;
    };

    Particles.prototype.getValue = function getValue(value) {
      return typeof value === 'number'? value :
             value? utils.random(value[0], value[1]) : 0;
    };

    Particles.prototype.createNew = function createNew() {
      var colour = utils.random(this.colours);
      var angle = this.getValue(this.angle);
      var size = this.getValue(this.size);
      var lifetime = this.getValue(this.lifetime);
      var speed = this.getValue(this.speed);
      var gravity = this.getValue(this.gravity);
      var x = -size / 2;
      var y = -size / 2;
      var speedRadian = (angle - 135) / (180 / Math.PI);
      var vSpeed = {
        'x': (speed * Math.cos(speedRadian)) - (speed * Math.sin(speedRadian)),
        'y': (speed * Math.sin(speedRadian)) + (speed * Math.cos(speedRadian))
      };

      if (!this.particles[colour]) {
        this.particles[colour] = [];
      }

      this.numberOfParticles++;
      this.particles[colour].push({
        'x': x,
        'y': y,
        'size': size,
        'halfSize': size / 2,
        'speedX': vSpeed.x,
        'speedY': vSpeed.y,
        'opacity': 1,
        'timeToLive': lifetime,
        'timeLived': 0,
        'life': 0,
        'gravity': gravity
      });
    };

    Particles.prototype.update = function update(dt) {
      for (var colour in this.particles) {
        var particles = this.particles[colour];

        for (var i = 0, len = particles.length, particle; i < len; i++) {
          particle = particles[i];

          if (particle) {
            particle.timeLived += dt;
            particle.life = particle.timeLived / particle.timeToLive;
            particle.opacity = 1 - particle.life;
            particle.x += (particle.speedX * dt);
            particle.y += (particle.speedY * dt);

            particle.speedY += particle.gravity * dt;

            if (particle.timeLived >= particle.timeToLive) {
              this.numberOfParticles--;
              particles.splice(i, 1);
              i--;
            }
          }
        }
      }

      if (this.isGenerating) {
        this.timeUntilNext -= dt;
        if (this.timeUntilNext <= 0) {
          this.timeUntilNext = this.getValue(this.frequency);
          this.createNew();
        }
      } else {
        if (this.frequency === 0 && this.numberOfParticles <= 0) {
          this.stop();
        }
      }
    };

    Particles.prototype.draw = function draw(context) {
      var i, len, particle;
      var x = this.position.x;
      var y = this.position.y;
      
      if (this.didCreateCanvas) {
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }

      for (var colour in this.particles) {
        var particles = this.particles[colour];

        context.fillStyle = colour;

        for (i = 0, len = particles.length; i < len; i++) {
          particle = particles[i];

          context.globalAlpha = particle.opacity;
          
          context.fillRect(x + particle.x, y + particle.y,
                           particle.size, particle.size);
        }
      }

      context.globalAlpha = 1;
    };

    var utils = {
      random: function random(from, to) {
        if (Array.isArray(from)) {
          return from[Math.floor(Math.random() * from.length)];
        }

        if (typeof from === 'boolean') {
          return Math.random() > 0.5;
        }

        if (to === undefined) {
          to = from || 1;
          from = 0;
        }

        return Math.random() * (to - from) + from;
      }
    };

    return Particles;
  }());
  
  return ModuleParticles;
}());
