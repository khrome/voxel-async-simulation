var createGame = require('voxel-engine')
var highlight = require('voxel-highlight')
var player = require('voxel-player')
var voxel = require('voxel');
var extend = require('extend')
var fly = require('voxel-fly')
var walk = require('voxel-walk');

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
    if(!this.options.texturePack) this.options.texturePack = 'PhotoRealistic';
    this.lookupMaterials = this.options.lookupMaterials || VoxelSimulation.lookupMaterials;
    options.texturePath = './texture-packs/'+
        this.options.texturePack+
        '/assets/minecraft/textures/blocks/',
    this.createWorld(options, function(err, world){
        ob.player = player(world)(options.playerSkin || 'player.png');
        ob.player.possess();
        ob.player.yaw.position.set(2, 14, 4);

        //attach view
        var container = options.container || document.body
        //window.game = game // for debugging
        world.appendTo(container)
        if (world.notCapable()) return;

        //setup
        var makeFly = fly(world)
        var target = world.controls.target()
        world.flyer = makeFly(target)

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
        })

        // block interaction stuff, uses highlight data
        var currentMaterial = 1

        world.on('fire', function (target, state) {
          var position = blockPosPlace
          if (position) {
            world.createBlock(position, currentMaterial)
          }
          else {
            position = blockPosErase
            if (position) world.setBlock(position, 0)
          }
      });

        world.on('tick', function() {
          walk.render(target.playerSkin)
          var vx = Math.abs(target.velocity.x)
          var vz = Math.abs(target.velocity.z)
          if (vx > 0.001 || vz > 0.001) walk.stopWalking()
          else walk.startWalking()
        })

        ob.emit('load-complete');
        if(options.onReady) options.onReady();
    });
    this.emit('load-start');
};

//Sphere, Noise, DenseNoise, Checker, Hill, Valley, HillyTerrain
VoxelSimulation.Generators = Generators;

VoxelSimulation.prototype.createWorld = function(options, cb){
    var ob = this;
    var chunkCache = {};
    this.on('chunk-loaded', function(key){
        console.log('LOADED: '+key);
    });
    this.initizationOptions(function(err, initOptions){
        var game = createGame({
          /*generate: intersect(
              (options.generate.land || VoxelSimulation.Generators.HillyTerrain),
              (options.generate.feature  || VoxelSimulation.Generators.Hill),
              function(a, b){
                  return b;
              }
          ),*/
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
                  //ob.emit('missingChunk', chunk.position);
                  console.log('chunk!')
                  if(options.chunkLoader) options.chunkLoader(chunk, function(err, result){
                      console.log('chunkLoader', arguments)
                      result.key = key;
                      ob.emit('recieve-chunk', result);
                  });
              }
              return chunk;
          },
          chunkDistance: options.loadDistance || 2,
          materials: initOptions.materials,
          texturePath: options.texturePath,
          materialFlatColor: !(options.useTextures || options.texturePath),
          worldOrigin: options.origin || [0, 0, 0],
          controls: { discreteFire: true }
        });
        ob.on('recieve-chunk', function(chunk){
            console.log('recieve-chunk', arguments)
            /*var voxels = new Int8Array(chunk.blocks.length);
            chunk.blocks.forEach(function(value, index) {
                voxels[index] = materialIndex(value);
            })*/

            chunkCache[chunk.key] = { //overwrite the old, empty dummy
                position: [chunk.position.x, chunk.position.y, chunk.position.z],
                voxels: chunk.blocks,
                dims: [32,32,32]
            };

            game.voxels.emit(
                'missingChunk',
                [chunk.position.x,
                chunk.position.y,
                chunk.position.z]
            );

            game.emit('chunk-loaded', chunk.key);
        })
        cb(undefined, game);
    });
};

VoxelSimulation.prototype.initizationOptions = function(cb){
    var ob = this;
    if(ob.initOpts){
        setTimeout(function(){
            cb(undefined, ob.initOpts);
        }, 1);
    }else{
        ob.lookupMaterials(
            VoxelSimulation.texturePack ||
            'PhotoRealistic',
            function(err, materials){
                ob.initOpts = {};
                ob.initOpts.materials = Object.keys(materials).map(function(key){
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
                })
                cb(undefined, ob.initOpts);
            }
        );
    }
};

module.exports = VoxelSimulation;
