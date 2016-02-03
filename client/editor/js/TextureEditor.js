var TextureEditor = (function TextureEditor() {
  function TextureEditor() {
    this.el = null;
    this.elContent = null;
    this.elContainer = null;
    this.elImage = null;
    this.elData = null;
    this.elSelection = null;
    this.image = null;
    
    this.texture = null;
    
    this.isVisible = false;
    
    this.ratio = 1;
    this.position = {
      'x': 0,
      'y': 0
    };
    
    this.padding = 400;
    
    this.fs = [
      {
        'path': 'images',
        'name': 'images',
        'isFolder': true,
        'files': []
      }
    ];
    
    this.onSelect = null;
    this.isBoundToGrid = true;
  }
  
  TextureEditor.prototype.init = function init(options) {
    !options && (options = {});
    
    this.editor = options.editor;
    this.elContainer = options.elContainer || document.body;
    
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    this.createHTML();
  };
  
  TextureEditor.prototype.onKeyDown = function onKeyDown(e) {
    if (e.keyCode === 17) {
      this.isBoundToGrid = false;
    }
  };
  
  TextureEditor.prototype.onKeyUp = function onKeyUp(e) {
    if (e.keyCode === 17) {
      this.isBoundToGrid = true;
    }
  };
  
  TextureEditor.prototype.show = function show(textureData, meta, onUpdate) {
    var game = this.editor.game;
    
    this.textureData = textureData;
    this.textureMeta = meta || {};
    this.onUpdate = onUpdate || null;
    
    if (!this.textureData.hasOwnProperty('width')) {
      this.textureData.width = game.config.tileSize;
    }
    if (!this.textureData.hasOwnProperty('height')) {
      this.textureData.height = game.config.tileSize;
    }
    if (!this.textureData.hasOwnProperty('clip')) {
      this.textureData.clip = {
        'x': 0,
        'y': 0
      };
    }
    
    this.loadImage();
  };
  
  TextureEditor.prototype.hide = function hide() {
    this.el.classList.remove('visible');
    this.isVisible = false;
  };
  
  TextureEditor.prototype.loadImage = function loadImage() {
    var game = this.editor.game;
    
    this.el.classList.remove('visible');
    
    this.image = new Image();
    this.image.addEventListener('load', this.onImageLoad.bind(this));
    this.image.src = game.getAssetPath(this.textureData.src, game.ASSET_TYPE.IMAGE);
  };
  
  TextureEditor.prototype.onImageLoad = function onImageLoad(e) {
    var width = this.image.width;
    var height = this.image.height;
    var ratioWidth = (this.elContainer.offsetWidth - this.padding) / width;
    var ratioHeight = (this.elContainer.offsetHeight - this.padding) / height;
    var ratio = Math.min(Math.min(ratioWidth, ratioHeight), 1);

    ratio = 1;
    this.ratio = ratio;
    
    window.resizeTo(width + this.elData.offsetWidth + 100, height + 100);
    
    /*
    width *= ratio;
    height *= ratio;
    
    this.elContent.style.cssText = [
      'width: ' + width + 'px',
      'height: ' + height + 'px',
      'margin-left: ' + (-width/2 + this.elData.offsetWidth) + 'px'
    ].join(';');
    */
    
    var selectionWidth = this.textureData.width * ratio;
    var selectionHeight = this.textureData.height * ratio;
    this.elSelection.style.width = selectionWidth + 'px';
    this.elSelection.style.height = selectionHeight + 'px';
    
    this.elImage.style.backgroundImage = 'url(' + this.image.src + ')';

    this.updateSelectionPosition(this.textureData.clip.x, this.textureData.clip.y);

    this.el.classList.add('visible');
    
    this.isVisible = true;
  };
  
  TextureEditor.prototype.onMouseMove = function onMouseMove(e) {
    var bounds = this.elImage.getBoundingClientRect();
    var x = Math.round((e.pageX - bounds.left) / this.ratio);
    var y = Math.round((e.pageY - bounds.top) / this.ratio);

    if (this.isBoundToGrid) {
      x -= (x % this.textureData.width);
      y -= (y % this.textureData.height);
    }
    
    this.updateSelectionPosition(x, y);
  };
  
  TextureEditor.prototype.updateSelectionPosition = function updateSelectionPosition(x, y) {
    this.textureData.clip.x = x;
    this.textureData.clip.y = y;
    
    this.elSelection.style.left = x * this.ratio + 'px';
    this.elSelection.style.top = y * this.ratio + 'px';
    
    this.dataPane.updateFromJSON(this.textureData);
  };
  
  TextureEditor.prototype.onDataChange = function onDataChange(e) {
    this.dataPane.updateJSON(this.textureData);
    this.onImageLoad();
    this.onUpdate(this.textureData);
  };
  
  TextureEditor.prototype.onSelectFile = function onSelectFile(path) {
    this.textureData.src = path;
    this.loadImage();
    this.dataPane.updateFromJSON(this.textureData);
    this.onUpdate(this.textureData);
  };
  
  TextureEditor.prototype.onClick = function onClick(e) {
    var elClicked = e.target;
    
    if (elClicked !== this.el) {
      this.onMouseMove(e);
      this.onUpdate(this.textureData);
    }
    
    this.hide();
  };

  TextureEditor.prototype.onKeyPress = function onKeyPress(e) {
    if (e.keyCode === 27) {
      this.hide();
    }
  };
  
  TextureEditor.prototype.createHTML = function createHTML() {
    this.el = document.createElement('div');
    
    this.el.className = 'texture-editor';
    
    this.el.innerHTML = '<div class="content">' +
                          '<div class="image"></div>' +
                          '<div class="selection"></div>' +
                        '</div>' +
                        '<div class="data">' +
                          '<div class="pane"></div>' +
                          '<div class="files"></div>' +
                        '</div>';
    
    this.elContent = this.el.querySelector('.content');
    this.elImage = this.el.querySelector('.image');
    this.elData = this.el.querySelector('.data');
    this.elFiles = this.elData.querySelector('.files');
    this.elSelection = this.el.querySelector('.selection');
    
    // Game info details pane
    this.dataPane = new Pane({
      'id': 'texture',
      'el': this.elData.querySelector('.pane'),
      'schema': this.editor.schema.texture,
      'onChange': this.onDataChange.bind(this)
    });
    
    this.files = new FileBrowser({
      'el': this.elFiles,
      'apiBasePath': '/api/game/' + this.editor.gameId + '/fs',
      'startingDir': 'images'
    });
    
    this.files.on(this.files.EVENTS.SELECT, this.onSelectFile.bind(this));
                        
    this.elImage.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.elImage.addEventListener('click', this.onClick.bind(this));
    window.addEventListener('keyup', this.onKeyPress.bind(this));
    
    this.elContainer.appendChild(this.el);
  };
  
  return new TextureEditor();
}());