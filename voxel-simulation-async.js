var createGame = require('voxel-engine')
var highlight = require('voxel-highlight')
var player = require('voxel-player')
var voxel = require('voxel');
var extend = require('extend')
var fly = require('voxel-fly')
var walk = require('voxel-walk');
var gameSky = require('voxel-sky');

//var random = require('seedable-random');
//var skmeans = require("skmeans");
var Emitter = require("extended-emitter");
var Generators = require("./voxel-generators");

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
    //if(!this.options.texturePack) throw Error()
    this.lookupMaterials = this.options.lookupMaterials ||
        VoxelSimulation.lookupMaterials;
    options.texturePath = './texture-packs/'+
        this.options.texturePack+
        '/assets/minecraft/textures/blocks/';
    this.build(function(){
        ob.emit('load-complete');
        if(options.onReady) options.onReady();
    });
    this.emit('load-start');
};

VoxelSimulation.prototype.build = function(cb){
    var ob = this;
    this.createWorld(this.options, function(err, world){
        ob.player = player(world)(options.playerSkin || 'player.png');
        ob.player.possess();
        ob.player.yaw.position.set(2, 14, 4);
        world.on('chunk-loaded', function(item){
            ob.emit('chunk-loaded', item);
        });
        //todo: investigate why this flag is needed
        var loaded;
        ob.once('chunk-loaded', {
            key:'0|0|0'
        }, function(chunk){
            if(!loaded){
                setTimeout(function(){
                    ob.player.position.set(0, 32, 0);
                    cb();
                }, 3000);
                loaded = true;
            }
        });

        //attach view
        var container = options.container || document.body
        //window.game = game // for debugging
        world.appendTo(container)
        if (world.notCapable()) return;

        //setup
        var makeFly = fly(world)
        var target = world.controls.target()
        world.flyer = makeFly(target);
        var sky = gameSky(world)();

        // highlight blocks when you look at them, hold <Ctrl> for block placement
        var blockPosPlace, blockPosErase
        var hl = world.highlighter = highlight(world, { color: 0xff0000 })
        hl.on('highlight', function (voxelPos) { blockPosErase = voxelPos })
        hl.on('remove', function (voxelPos) { blockPosErase = null })
        hl.on('highlight-adjacent', function (voxelPos) { blockPosPlace = voxelPos })
        hl.on('remove-adjacent', function (voxelPos) { blockPosPlace = null })

        ob.player.toggle(); //start in third person
        // toggle between first and third person modes
        window.addEventListener('keydown', function (ev) {
            if (ev.keyCode === 'R'.charCodeAt(0)) ob.player.toggle()
        });

        // block interaction stuff, uses highlight data
        var currentMaterial = 1

        world.on('fire', function (target, state) {
            var position = blockPosPlace
            if(position){
                world.createBlock(position, currentMaterial)
            }else{
                position = blockPosErase
                if (position) world.setBlock(position, 0)
            }
        });

        world.on('tick', function() {
            walk.render(target.playerSkin)
            var vx = Math.abs(target.velocity.x)
            var vz = Math.abs(target.velocity.z)
            if (vx > 0.001 || vz > 0.001) walk.stopWalking()
            else walk.startWalking();
            sky();
        });
    });
};

//Sphere, Noise, DenseNoise, Checker, Hill, Valley, HillyTerrain
VoxelSimulation.Generators = Generators;

VoxelSimulation.prototype.createWorld = function(options, cb){
    var ob = this;
    var chunkCache = {};
    this.initizationOptions(function(err, initOptions){
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
          chunkDistance: options.chunkDistance || 3,
          texturePath: options.texturePath,
          materialFlatColor: !(options.useTextures || options.texturePath),
          worldOrigin: options.origin || [0, 0, 0],
          lightsDisabled: true,
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
            'PhotoRealistic',
            function(err, materials){
                ob.initOpts = {};
                var mats = Object.keys(materials).sort(function(a, b){
                    if(!ob.options.materialsOrdering){
                        return a > b;
                    }
                    var mo = ob.options.materialsOrdering;
                    return comparable(a, mo) < comparable(b, mo);
                });
                ob.initOpts.materials = mats.map(function(key){
                    return materials[key];
                }).filter(function(item){
                    return !!item.side;
                }).map(function(item){
                    if(item.top && item.bottom && item.side){
                        return [item.top, item.bottom, item.side];
                    }
                    if(item.top && item.side){
                        return [item.top, item.side, item.side];
                    }
                    if(item.bottom && item.side){
                        return [item.side, item.bottom, item.side];
                    }
                    return item.side;
                });
                cb(undefined, ob.initOpts);
            }
        );
    }
};

VoxelSimulation.Client = function(options){
    if(!options) options = {};
    var request = require('browser-request');
    if(!options.chunkLoader) options.chunkLoader = function(placeholderChunk, complete){
        var url = '/chunk/'+
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
            var blocks = data.blocks;
            for(var lcv=0; lcv<results.length; lcv++){
                results[lcv] = blocks[lcv];
            }
            data.blocks = results;
            complete(undefined, data);
        })
    };
    if(!options.lookupMaterials) options.lookupMaterials = function(texturePack, cb){
        var url = '/assets/'+texturePack+'/blocks';
        request({
            uri :url,
            json : true
        }, function(err, response, data){
            if(err) return cb(err);
            if(data.blocks){
                return cb(undefined, data.blocks);
            }
            cb(undefined, undefined);
        })
    };
    var thisSim = new VoxelSimulation(options);
    return thisSim;
}

module.exports = VoxelSimulation;
