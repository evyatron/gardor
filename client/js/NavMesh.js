/*
  Navigation mesh - this class creates a walkable grid
  Used by the game and actors to find movements paths
  * uses EasyStar http://www.easystarjs.com/
*/
"use strict";

var NavMesh = (function NavMesh() {
  var EasyStar={};EasyStar.Node=function(t,n,e,i,s){this.parent=t,this.x=n,this.y=e,this.costSoFar=i,this.simpleDistanceToTarget=s,this.bestGuessDistance=function(){return this.costSoFar+this.simpleDistanceToTarget}},EasyStar.Node.OPEN_LIST=0,EasyStar.Node.CLOSED_LIST=1,EasyStar.PriorityQueue=function(t,n){this.length=0;var e=[],i=!1;if(n==EasyStar.PriorityQueue.MAX_HEAP)i=!0;else{if(n!=EasyStar.PriorityQueue.MIN_HEAP)throw n+" not supported.";i=!1}this.insert=function(n){if(!n.hasOwnProperty(t))throw"Cannot insert "+n+" because it does not have a property by the name of "+t+".";e.push(n),this.length++,s(this.length-1)},this.getHighestPriorityElement=function(){return e[0]},this.shiftHighestPriorityElement=function(){if(0===this.length)throw"There are no more elements in your priority queue.";if(1===this.length){var t=e[0];return e=[],this.length=0,t}var n=e[0],i=e.pop();return this.length--,e[0]=i,o(0),n};var s=function(t){if(0!==t){var n=u(t);a(t,n)&&(r(t,n),s(n))}},o=function(t){var n=h(t),e=c(t);if(a(n,t))r(t,n),o(n);else if(a(e,t))r(t,e),o(e);else{if(0==t)return;o(0)}},r=function(t,n){var i=e[t];e[t]=e[n],e[n]=i},a=function(n,s){if(void 0===e[s]||void 0===e[n])return!1;var o,r;return"function"==typeof e[n][t]?(o=e[n][t](),r=e[s][t]()):(o=e[n][t],r=e[s][t]),i?o>r?!0:!1:r>o?!0:!1},u=function(t){return Math.floor((t-1)/2)},h=function(t){return 2*t+1},c=function(t){return 2*t+2}},EasyStar.PriorityQueue.MAX_HEAP=0,EasyStar.PriorityQueue.MIN_HEAP=1,EasyStar.instance=function(){this.isDoneCalculating=!0,this.pointsToAvoid={},this.startX,this.callback,this.startY,this.endX,this.endY,this.nodeHash={},this.openList},EasyStar.js=function(){var t,n,e,i=1,s=1.4,o=!1,r={},a={},u={},h=!0,c=[],l=Number.MAX_VALUE,f=!1;this.setAcceptableTiles=function(t){t instanceof Array?e=t:!isNaN(parseFloat(t))&&isFinite(t)&&(e=[t])},this.enableSync=function(){o=!0},this.disableSync=function(){o=!1},this.enableDiagonals=function(){f=!0},this.disableDiagonals=function(){f=!1},this.setGrid=function(n){t=n;for(var e=0;e<t.length;e++)for(var i=0;i<t[0].length;i++)a[t[e][i]]||(a[t[e][i]]=1)},this.setTileCost=function(t,n){a[t]=n},this.setAdditionalPointCost=function(t,n,e){u[t+"_"+n]=e},this.removeAdditionalPointCost=function(t,n){delete u[t+"_"+n]},this.removeAllAdditionalPointCosts=function(){u={}},this.setIterationsPerCalculation=function(t){l=t},this.avoidAdditionalPoint=function(t,n){r[t+"_"+n]=1},this.stopAvoidingAdditionalPoint=function(t,n){delete r[t+"_"+n]},this.enableCornerCutting=function(){h=!0},this.disableCornerCutting=function(){h=!1},this.stopAvoidingAllAdditionalPoints=function(){r={}},this.findPath=function(n,s,r,a,u){var h=function(t){o?u(t):setTimeout(function(){u(t)})};if(void 0===e)throw new Error("You can't set a path without first calling setAcceptableTiles() on EasyStar.");if(void 0===t)throw new Error("You can't set a path without first calling setGrid() on EasyStar.");if(0>n||0>s||0>r||0>r||n>t[0].length-1||s>t.length-1||r>t[0].length-1||a>t.length-1)throw new Error("Your start or end point is outside the scope of your grid.");if(n===r&&s===a)return h([]),void 0;for(var l=t[a][r],f=!1,y=0;y<e.length;y++)if(l===e[y]){f=!0;break}if(f===!1)return h(null),void 0;var d=new EasyStar.instance;d.openList=new EasyStar.PriorityQueue("bestGuessDistance",EasyStar.PriorityQueue.MIN_HEAP),d.isDoneCalculating=!1,d.nodeHash={},d.startX=n,d.startY=s,d.endX=r,d.endY=a,d.callback=h,d.openList.insert(p(d,d.startX,d.startY,null,i)),c.push(d)},this.calculate=function(){if(0!==c.length&&void 0!==t&&void 0!==e)for(n=0;l>n;n++){if(0===c.length)return;if(o&&(n=0),0!==c[0].openList.length){var r=c[0].openList.shiftHighestPriorityElement(),a=[];r.list=EasyStar.Node.CLOSED_LIST,r.y>0&&a.push({instance:c[0],searchNode:r,x:0,y:-1,cost:i*v(r.x,r.y-1)}),r.x<t[0].length-1&&a.push({instance:c[0],searchNode:r,x:1,y:0,cost:i*v(r.x+1,r.y)}),r.y<t.length-1&&a.push({instance:c[0],searchNode:r,x:0,y:1,cost:i*v(r.x,r.y+1)}),r.x>0&&a.push({instance:c[0],searchNode:r,x:-1,y:0,cost:i*v(r.x-1,r.y)}),f&&(r.x>0&&r.y>0&&(h||d(t,e,r.x,r.y-1)&&d(t,e,r.x-1,r.y))&&a.push({instance:c[0],searchNode:r,x:-1,y:-1,cost:s*v(r.x-1,r.y-1)}),r.x<t[0].length-1&&r.y<t.length-1&&(h||d(t,e,r.x,r.y+1)&&d(t,e,r.x+1,r.y))&&a.push({instance:c[0],searchNode:r,x:1,y:1,cost:s*v(r.x+1,r.y+1)}),r.x<t[0].length-1&&r.y>0&&(h||d(t,e,r.x,r.y-1)&&d(t,e,r.x+1,r.y))&&a.push({instance:c[0],searchNode:r,x:1,y:-1,cost:s*v(r.x+1,r.y-1)}),r.x>0&&r.y<t.length-1&&(h||d(t,e,r.x,r.y+1)&&d(t,e,r.x-1,r.y))&&a.push({instance:c[0],searchNode:r,x:-1,y:1,cost:s*v(r.x-1,r.y+1)})),a.sort(function(t,n){var e=t.cost+g(r.x+t.x,r.y+t.y,c[0].endX,c[0].endY),i=n.cost+g(r.x+n.x,r.y+n.y,c[0].endX,c[0].endY);return i>e?-1:e===i?0:1});for(var u=!1,p=0;p<a.length;p++)if(y(a[p].instance,a[p].searchNode,a[p].x,a[p].y,a[p].cost),a[p].instance.isDoneCalculating===!0){u=!0;break}u&&c.shift()}else{var x=c[0];x.callback(null),c.shift()}}};var y=function(n,i,s,o,a){var u=i.x+s,h=i.y+o;if(void 0===r[u+"_"+h]){if(n.endX===u&&n.endY===h){n.isDoneCalculating=!0;var c=[],l=0;c[l]={x:u,y:h},l++,c[l]={x:i.x,y:i.y},l++;for(var f=i.parent;null!=f;)c[l]={x:f.x,y:f.y},l++,f=f.parent;c.reverse();var y=n,v=c;return y.callback(v),void 0}if(d(t,e,u,h)){var g=p(n,u,h,i,a);void 0===g.list?(g.list=EasyStar.Node.OPEN_LIST,n.openList.insert(g)):g.list===EasyStar.Node.OPEN_LIST&&i.costSoFar+a<g.costSoFar&&(g.costSoFar=i.costSoFar+a,g.parent=i)}}},d=function(t,n,e,i){for(var s=0;s<n.length;s++)if(t[i][e]===n[s])return!0;return!1},v=function(n,e){return u[n+"_"+e]||a[t[e][n]]},p=function(t,n,e,i,s){if(void 0!==t.nodeHash[n+"_"+e])return t.nodeHash[n+"_"+e];var o=g(n,e,t.endX,t.endY);if(null!==i)var r=i.costSoFar+s;else r=o;var a=new EasyStar.Node(i,n,e,r,o);return t.nodeHash[n+"_"+e]=a,a},g=function(t,n,e,i){return Math.sqrt((e-=t)*e+(i-=n)*i)}};
  
  function NavMesh(options) {
    this.mesh = [];
    this.pathFinding = null;
    
    this.init(options);
  }
  
  NavMesh.prototype.init = function init(options) {
    this.game = options.game;
    this.pathFinding = new EasyStar.js();
  };
  
  NavMesh.prototype.isBlocked = function isBlocked(tile) {
    var row = this.mesh[tile.y];
    if (!row) {
      return true;
    }
    
    if (row[tile.x] === undefined) {
      return true;
    }
    
    return row[tile.x] === false;
  };
  
  NavMesh.prototype.findPath = function findPath(from, to, callback) {
    if (!callback) {
      console.warn('Trying to find path without callback', arguments);
      return false;
    }
    
    this.pathFinding.findPath(from.x, from.y, to.x, to.y, function onCalculated(path) {
      if (path === null) {
        console.warn('no path found');
      } else {
        path.splice(0, 1);
      }
      
      callback && callback(path);
    });
    
    this.pathFinding.calculate();
    
    return true;
  };
  
  NavMesh.prototype.update = function update() {
    var game = this.game;
    var map = game.currentMap;
    
    if (!map) {
      return false;
    }
    
    var grid = map.grid;
    var tilesMap = this.game.tiles;
    var defaultTile = map.defaultTile;
    var acceptable = [];
    
    this.mesh = [];
    
    for (var i = 0, numberOfRows = grid.length; i < numberOfRows; i++) {
      var row = grid[i];
      var meshRow = [];
      
      for (var j = 0, numberOfCols = row.length; j < numberOfCols; j++) {
        var tile = tilesMap[row[j] || defaultTile];
        
        if (tile) {
          if (tile.isBlocking) {
            meshRow.push(false);
          } else {
            var areActorsBlocking = false;
            var actors = game.getActorsOnTile({
              'x': j,
              'y': i
            });
            
            for (var iActor = 0, len = actors.length; iActor < len; iActor++) {
              if (actors[iActor].isBlocking) {
                areActorsBlocking = true;
                break;
              }
            }
            
            if (areActorsBlocking) {
              meshRow.push(false);
            } else {
              meshRow.push(tile.walkCost);
              
              if (acceptable.indexOf(tile.walkCost) === -1) {
                this.pathFinding.setTileCost(tile.walkCost, tile.walkCost);
                acceptable.push(tile.walkCost);
              }
            }
          }
        } else {
          meshRow.push(false);
        }
      }
      
      this.mesh.push(meshRow);
    }
    
    this.pathFinding.setAcceptableTiles(acceptable);
    this.pathFinding.setGrid(this.mesh);
    
    return true;
  };

  return NavMesh;
}());