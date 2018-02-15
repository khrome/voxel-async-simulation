var createGame = require('voxel-engine')
var highlight = require('voxel-highlight')
var player = require('voxel-player')
var voxel = require('voxel');
var extend = require('extend')
var fly = require('voxel-fly')
var walk = require('voxel-walk');
var createWeather = require('voxel-weather');
var Generator = require('voxel-generators');
var uuid = require('uuid');
var isElectron = require('is-electron');

// This is super shitty, but so is tossing the chunk *before* the event
createGame.prototype.removeFarChunks = function(playerPosition) {
  var self = this
  playerPosition = playerPosition || this.playerPosition()
  var nearbyChunks = this.voxels.nearbyChunks(playerPosition, this.removeDistance).map(function(chunkPos) {
    return chunkPos.join('|')
  })
  Object.keys(self.voxels.chunks).map(function(chunkIndex) {
    if (nearbyChunks.indexOf(chunkIndex) > -1) return
    var chunk = self.voxels.chunks[chunkIndex]
    var mesh = self.voxels.meshes[chunkIndex]
    var pendingIndex = self.pendingChunks.indexOf(chunkIndex)
    if (pendingIndex !== -1) self.pendingChunks.splice(pendingIndex, 1)
    if (!chunk) return;
    var chunkPosition = chunk.position
    if (mesh) {
      if (mesh.surfaceMesh) {
        self.scene.remove(mesh.surfaceMesh)
        mesh.surfaceMesh.geometry.dispose()
      }
      if (mesh.wireMesh) {
        mesh.wireMesh.geometry.dispose()
        self.scene.remove(mesh.wireMesh)
      }
      delete mesh.data
      delete mesh.geometry
      delete mesh.meshed
      delete mesh.surfaceMesh
      delete mesh.wireMesh
    }
    delete self.voxels.chunks[chunkIndex]
    self.emit('removeChunk', chunk);
  })
  self.voxels.requestMissingChunks(playerPosition)
}

//var random = require('seedable-random');
//var skmeans = require("skmeans");
var Emitter = require("extended-emitter");
var Generators = require("voxel-generators");

function handlePart(index, part, list){
    list.filter(function(item){
        return item.indexOf('_'+part) !== -1;
    }).forEach(function(item){
        var name = item.substring(item.indexOf('_'+part));
        if(!index[name])byName[name] = {};
        index[name][part] = item;
    });
}

var fs;

VoxelSimulation.lookupMaterials = function(texturePack, cb){
    fs.readdir(
        process.cwd()+
        '/texture-packs/'+
        texturePack+
        '/assets/minecraft/textures/blocks', function(err, list){
            var byName = {};
            handlePart(byName, 'side', list);
            handlePart(byName, 'end', list);
            handlePart(byName, 'top', list);
            handlePart(byName, 'bottom', list);
            list.filter(function(item){
                return
                    item.indexOf('_side') === -1 &&
                    item.indexOf('_end') === -1 &&
                    item.indexOf('_top') === -1 &&
                    item.indexOf('_bottom') === -1
                ;
            }).forEach(function(item){
                if(!index[name])byName[name] = {};
                index[name].main = item;
            });
            var result = Object.keys(byName).map(function(name){
                return byName[name];
            }).sort(function(a, b){
                return Object.keys(a).length >= Object.keys(b).length;
            });
            cb(undefined, result);
        }
    );
}

VoxelSimulation.setMaterials = function(materials){
    VoxelSimulation.lookupMaterials = function(texturePack, cb){
        setTimeout(function(){
            cb(undefined, materials);
        }, 1);
    }
};

function VoxelSimulation(options){
    var ob = this;
    this.options = options || {};
    (new Emitter()).onto(this);
    if(!this.options.seed) this.options.seed = uuid.v1();

    //if(!this.options.texturePack) throw Error()
    this.lookupMaterials = this.options.lookupMaterials ||
        VoxelSimulation.lookupMaterials;
    options.texturePath = './texture-packs/'+
        this.options.texturePack+
        '/assets/minecraft/textures/blocks/';
    if(!options.delayedBuild) this.build(function(){ });
    //SHAMEFUL INPUT HACK
    this.mouseDown = [0, 0, 0, 0, 0, 0, 0, 0, 0],
    this.mouseDownCount = 0;
    ob = this;
    document.body.onmousedown = function(evt) {
      ++ob.mouseDown[evt.button];
      ++ob.mouseDownCount;
    }
    document.body.onmouseup = function(evt) {
      --ob.mouseDown[evt.button];
      --ob.mouseDownCount;
    }
};

VoxelSimulation.prototype.simulateMouseButton = function(button){
    if(button === false){
        this.mouseDown = this.mouseDown.map(function(item){
            return 0;
        })
    }else{
        this.mouseDown[button] = 1;
    }
};

VoxelSimulation.prototype.destroy = function(cb){
    setTimeout(function(){
        if(cb) cb();
    }, 0);
};

VoxelSimulation.prototype.build = function(cb){
    var ob = this;
    var options = ob.options;
    this.emit('load-start');
    this.createWorld(this.options, function(err, world){
        ob.emit('load-complete');
        ob.world = world;
        if(!ob.options.randomSeed) ob.options.randomSeed = uuid.v4();
        if(!ob.options.graphicsQuality) ob.options.graphicsQuality = 3;
        ob.player = player(world)(ob.options.playerSkin || 'player.png');
        ob.player.possess();
        ob.player.yaw.position.set(2, 14, 4);
        var dirtyChunks = [];
        world.on('dirtyChunkUpdate', function(chunk){
            if(dirtyChunks.indexOf(chunk) === -1) dirtyChunks.push(chunk);
        })
        // timer outside game timings, debounced a little
        // current players will get stream updates,
        // joining players might get out of sync (mb event on file change?)
        setInterval(function(){
            if(options.chunkSaver && dirtyChunks.length){
                options.chunkSaver(dirtyChunks.shift(), function(err){
                    if(err) console.log('ERROR SAVING', err);
                    console.log('SAVED CHUNK');
                });
            }
        }, 200);
        world.on('chunk-loaded', function(item){
            ob.emit('chunk-loaded', item);
        });
        var makeFly = fly(world)
        var target = world.controls.target()
        world.flyer = makeFly(target);

        //todo: investigate why this flag is needed
        var loaded;
        ob.once('chunk-loaded', {
            key:'0|0|0'
        }, function(chunk){
            if(!loaded){
                setTimeout(function(){
                    if(cb) cb(undefined, target, world, ob.options);
                }, 2000);
                loaded = true;
            }
        });

        //attach view
        var container = options.container || document.body;
        world.appendTo(container)
        if (world.notCapable()) return;

        //setup
        var showSky = (options.quality && options.quality > 1);
        var showWeather = (options.quality && options.quality > 2);
        var weather = createWeather(world, showSky, showWeather);
        weather(ob.options.weatherCycle || [
            'clear', 'cloudy', 'sprinkle', 'rain', 'stormy', 'rain',
            'sprinkle', 'cloudy', 'clear', 'clear', 'clear', 'clear'
        ]);
        // highlight blocks when you look at them, hold <Ctrl> for block placement
        var blockPosPlace, blockPosErase
        var lastMode;
        var hl = world.highlighter = highlight(world, {
            color: options.highlightColor || 0xff0000,
            selectActive: function(){
                //return !!ob.placing;
                return ob.mouseDown[1];
            },
            adjacentActive: function(){
                //return !!ob.placing;
                return ob.mouseDown[0];
            }
        })
        ob.hl = hl;
        hl.on('highlight', function (voxelPos) {
            blockPosErase = voxelPos
        });
        hl.on('remove', function (voxelPos) {
            blockPosErase = null
        });
        hl.on('highlight-adjacent', function(voxelPos){
            blockPosPlace = voxelPos
        });
        hl.on('remove-adjacent', function(voxelPos){
            blockPosPlace = null
        });


        world.on('fire', function(target, state) {
            setTimeout(function(){
                var position = blockPosPlace;
                if(ob.mouseDown[2]){
                        world.emit('destroy-voxel', blockPosErase);
                }
                if(ob.mouseDown[1]){
                        world.emit('inspect-voxel', blockPosErase);
                }
                if(ob.mouseDown[0]){
                        world.emit('empty-voxel', blockPosPlace);
                }
            }, 100);
        });
    });
};

//Sphere, Noise, DenseNoise, Checker, Hill, Valley, HillyTerrain
VoxelSimulation.Generators = Generators;

VoxelSimulation.prototype.deselect = function(){
    this.hl.selectStart = null
}

VoxelSimulation.prototype.createWorld = function(options, cb){
    var ob = this;
    var chunkCache = {};
    this.initizationOptions(function(err, initOptions){
        var chunkDistance = options.quality?(options.quality+1):
            (options.chunkDistance || 2);
        var game = createGame({
          generateVoxelChunk: function(low, high, x, y, z) {
              var key = [x,y,z].join('|');
              var chunk = chunkCache[key];
              if (!chunk) {
                  chunk = {
                      position:[x,y,z],
                      voxels:new Int8Array(32*32*32),
                      dims:[32,32,32],
                      empty:true
                  };
                  chunkCache[key] = chunk;
                  if(options.chunkLoader) options.chunkLoader(chunk, function(err, result){
                      result.key = key;
                      result.position = [x,y,z];
                      ob.emit('recieve-chunk', result);
                  });
              }
              return chunk;
          },
          materials: initOptions.materials,
          chunkDistance: chunkDistance,
          texturePath: options.texturePath,
          materialFlatColor: !(options.useTextures || options.texturePath),
          worldOrigin: options.origin || [0, 0, 0],
          fogDisabled: (options.quality && options.quality > 2)?false:true,
          skyColor: options.skyColor|| 0x6666CC,
          lightsDisabled: (options.quality && options.quality == 1)?false:true,
          controls: { discreteFire: true }
        });
        ob.on('recieve-chunk', function(chunk){

            chunkCache[chunk.key] = { //overwrite the old, empty dummy
                position: chunk.position,
                voxels: chunk.blocks,
                dims: [32,32,32]
            };

            game.voxels.emit(
                'missingChunk',
                chunk.position
            );
            (function(){
                ob.emit('chunk-loaded', chunk);
            })()
        })
        cb(undefined, game);
    });
};

function comparable(a, o){
    var r = o.indexOf(a);
    if(r === -1) return r;
    return a.length - r;
}

VoxelSimulation.prototype.initizationOptions = function(cb){
    var ob = this;
    if(ob.initOpts){
        setTimeout(function(){
            cb(undefined, ob.initOpts);
        }, 1);
    }else{
        ob.lookupMaterials(
            ob.options.texturePack ||
            'freeture',
            function(err, materials){
                if(!materials.length) (console.warn || console.log)('No materials recieved')
                ob.initOpts = {};
                ob.initOpts.materials = materials;
                cb(undefined, ob.initOpts);
            }
        );
    }
};

VoxelSimulation.Client = function(options){
    if(!options) options = {};
    var request = require('browser-request');
    var thisSim;

    if(!options.chunkLoader) options.chunkLoader = function(placeholderChunk, complete){
        var url = '/chunk/'+thisSim.options.seed+'/'+
            placeholderChunk.position[0]+'/'+
            placeholderChunk.position[1]+'/'+
            placeholderChunk.position[2];
        request({
            uri :url,
            json : true
        }, function(err, response, data){
            if(err) throw(err);
            if(data.error) throw(new Error(data.message || (
                typeof data.error == 'boolean'?
                    'Error requesting url:'+url:
                    data.error
            )));
            var results = new Int8Array(32*32*32);
            var blocks = data.blocks || data.voxels;
            for(var lcv=0; lcv<results.length; lcv++){
                results[lcv] = blocks[lcv];
            }
            data.blocks = results;
            complete(undefined, data);
        })
    };

    if(options.save === true && (!options.chunkSaver)) options.chunkSaver = function(chunk, complete){
        var url = '/chunk/'+thisSim.options.seed+'/'+chunk.position[0]+'/'+
            chunk.position[1]+'/'+chunk.position[2];
        request({
            uri :url,
            method: 'post',
            json : chunk
        }, function(err, response, data){
            if(err) console.log('Could not save chunk:', err);
            if(!(data && data.success)) console.log('Failed to save chunk');
            complete(err);
        })
    };

    if(!options.lookupMaterials) options.lookupMaterials = function(texturePack, cb){
        var url = '/assets/'+texturePack+'/blocks';
        request({
            uri :url,
            json : true
        }, function(err, response, data){
            if(err) return cb(err);
            if(data){
                return cb(undefined, data);
            }
            cb(undefined, undefined);
        })
    };
    thisSim = new VoxelSimulation(options);
    return thisSim;
}

module.exports = VoxelSimulation;
