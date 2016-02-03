var FileBrowser = (function FileBrowser() {
  function FileBrowser(options) {
    this.el = null;
    this.elTooltip = null;
    this.apiBasePath = '';
    
    this.fs = [];
    
    this.EVENTS = {
      SELECT: 'selectFile'
    };
    
    this.init(options);
  }
  
  FileBrowser.prototype = Object.create(EventDispatcher.prototype);
  FileBrowser.prototype.constructor = FileBrowser;
  
  FileBrowser.prototype.init = function init(options) {
    this.el = options.el;
    this.apiBasePath = options.apiBasePath;
    this.startingDir = options.startingDir || '';
    
    this.fs.push({
      'path': this.startingDir,
      'name': this.startingDir,
      'isFolder': true,
      'files': []
    });
    
    this.createHTML();
    
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.el.addEventListener('click', this.onClick.bind(this));

    this.getAllFiles();
  };
  
  FileBrowser.prototype.getAllFiles = function getAllFiles() {
    this.fs[0].files = [];
    this.getFiles(this.fs[0]);
  };
  
  FileBrowser.prototype.onMouseMove = function onMouseMove(e) {
    var el = e.target;
    
    if (el.dataset.isFolder === 'false') {
      var path = el.dataset.path;
      if (path) {
        path = editor.game.getAssetPath(path);
        
        var bounds = el.getBoundingClientRect();
        
        this.elTooltip.dataset.type = 'image';
        this.elTooltip.innerHTML = '<div class="image" style="background-image: url(\'' + path + '\')"></div>';
        
        this.elTooltip.style.transform = 'translate(' + (bounds.left + bounds.width) + 'px, ' + (bounds.top + bounds.height / 2) + 'px)';
        this.elTooltip.classList.add('visible');
      }
    } else {
      this.elTooltip.classList.remove('visible');
    }
  };
  
  FileBrowser.prototype.onClick = function onClick(e) {
    var el = e.target;
    
    if (el.dataset.isFolder === 'false') {
      var path = el.dataset.path;
      if (path) {
        path = path.replace(this.startingDir + '/', '');
        this.dispatch(this.EVENTS.SELECT, path);
      }
    }
  };

  FileBrowser.prototype.getFiles = function getFiles(pathObj) {
    var path = this.apiBasePath + '?dir=' + pathObj.path;

    utils.request(path, function onGotAPIResponse(files) {
      this.onGotFiles(pathObj, files);
    }.bind(this));
  };
  
  FileBrowser.prototype.onGotFiles = function onGotFiles(pathObj, files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var entry = {
        'path': pathObj.path + '/' + file,
        'name': file,
        'isFolder': !/\./.test(file),
        'files': []
      };
      
      if (entry.isFolder) {
        this.getFiles(entry);
      }
      
      pathObj.files.push(entry);
    }
    
    pathObj.files.sort(function sorter(a, b) {
      var nameA = a.name.replace(/\..*/g, '');
      var nameB = b.name.replace(/\..*/g, '');
      
      return a.isFolder && !b.isFolder? -1 :
             !a.isFolder && b.isFolder? 1 :
             nameA < nameB? -1 :
             nameA > nameB? 1 :
             0;
    });
    
    this.printFiles();
  };
  
  FileBrowser.prototype.printFiles = function printFiles() {  
    this.ellist.innerHTML = this.getDirHTML(this.fs[0]);
  };
  
  FileBrowser.prototype.getDirHTML = function getDirHTML(entry) {
    var html = '<li class="folder-' + entry.isFolder + '"' +
                  'data-is-folder="' + entry.isFolder + '"' +
                  'data-path="' + entry.path + '">' +
               '<div class="name">' + entry.name + '</div>';
    
    if (entry.isFolder) {
      html += '<ul>';
      
      for (var i = 0; i < entry.files.length; i++) {
        html += this.getDirHTML(entry.files[i]);
      }
      
      html += '</ul>';
    }
    
    html += '</li>';
    
    return html;
  };
  
  FileBrowser.prototype.uploadFile = function uploadFile(file, path) {
    var apiPath = this.apiBasePath + '?dir=' + path;
    var request = new XMLHttpRequest();
    var files = new FormData();
    
    console.warn('Uploading file [' + path + '/' + file.name + ']', file);
    
    request.open('POST', apiPath, true);
    
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        this.getAllFiles();
      }
    }.bind(this);
    
    files.append('file', file);
    
    request.send(files);
  };
  
  FileBrowser.prototype.onDragOver = function onDragOver(e) {
    e.preventDefault();
  };
  
  FileBrowser.prototype.onDrop = function onDrop(e) {
    var el = e.target;
    e.preventDefault();
    
    if (el.dataset.hasOwnProperty('isFolder')) {
      var files = e.dataTransfer.files;
      if (files.length > 0) {
        var folder = el.dataset.path.replace(/([^\/]*[^\.]\..*)$/, '');
        
        console.warn('Drop [' + files.length + '] files to [' + folder + ']:', files);
        
        for (var i = 0, len = files.length; i < len; i++) {
          this.uploadFile(files[i], folder);
        }
      }
    }
  };
  
  FileBrowser.prototype.onDragEnd = function onDragEnd(e) {
    e.preventDefault();
  };
  
  FileBrowser.prototype.createHTML = function createHTML() {
    this.ellist = document.createElement('ul');
    this.el.appendChild(this.ellist);
    
    this.elTooltip = document.createElement('div');
    this.elTooltip.className = 'file-system-tooltip';
    
    window.addEventListener('dragover', this.onDragOver.bind(this));
    window.addEventListener('dragend', this.onDragEnd.bind(this));
    window.addEventListener('drop', this.onDrop.bind(this));
    
    document.body.appendChild(this.elTooltip);
  };
  
  return FileBrowser;
}());