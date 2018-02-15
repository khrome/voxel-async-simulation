var express = require('express');
var bodyParser = require('body-parser');
var voxel = require('voxel');
var Generators = require('voxel-generators');
var WorldBuilder = require('voxel-biomes');
var loadTexturePack = require('voxel-minecraft-texture-pack-loader');
var group = require('group-by-subsequence');
var primes = require('primes');
var fs = require('fs');
var isElectron = require('is-electron');

var jsonParser = bodyParser.json({limit: '3mb'});

var storage;

var subgen = function(subX, subY, subZ){
    return function(x, y, z){
        if(y === 0 && subY === 0){
            return 1;
        }
        return 0;
    }
};

var app = express();

function check(a){
    if(a > 100) return 0;
    return a;
}

function handlePart(index, part, list){
    list.filter(function(item){
        return item.indexOf('_'+part) !== -1;
    }).forEach(function(item){
        var name = item.substring(0, item.indexOf('_'+part));
        if(!index[name])index[name] = {name:name};
        index[name][part] = item;
    });
}

var offset = 32*32;
var lookups = {};
var submeshes = {};
app.use(express.static('.', {
    dotfiles: 'ignore',
    etag: false,
    extensions: [
        'png', 'gif', 'jpg', 'jpeg', 'json', 'js', 'html', 'css',
        'ttf', 'eot', 'woff', 'ico', 'otf', 'svg'
    ],
    index: false,
    maxAge: '1d',
    redirect: false,
    setHeaders: function (res, path, stat) {
        res.set('x-timestamp', Date.now())
    }
}));

function generateSubmesh(x, y, z, subgenerator){
    var data = [];
    var xOff = 32 * 32;
    yOff = 32;
    var xPart;
    var yPart;
    var gen = (subgenerator||subgen)(x, y, z);
    for(var x=0; x < 32; x++ ){
        xPart = x * xOff;
        for(var y=0; y < 32; y++ ){
            yPart = y * yOff;
            for(var z=0; z < 32; z++ ){
                data[xPart + yPart + z] = check(gen(x, y, z));
            }
        }
    }
    var results = {
        blocks : data,
        position : {
            x : x,
            y : y,
            z : z
        }
    }
    return results;
}

var generatorRequestor;
app.get('/chunk/:world/:x/:y/:z', function(req, res){
    var x = req.params.x;
    var y = req.params.y;
    var z = req.params.z;
    var worldName = req.params.world;
    generatorRequestor(worldName, function(err, config, texturePack, builder){
        var distroFn;
        if(config.distribution === 'prime'){
            distroFn = WorldBuilder.Segmenters.primes();
        }else{
            var parts = config.distribution.split(':')
            if(parts[0] !== 'modulo') throw new Error('unknown')
            distroFn = WorldBuilder.Segmenters.modulo(parseInt(parts[0]));
        }
        var generator = builder.buildGenerator(distroFn);
        if(storage){
            storage.loader(worldName, x, y, z, function(err, data){
                if(err) throw err;
                var results = data || generateSubmesh(x, y, z, generator);
                res.end(JSON.stringify(results));
            });
        }else{
            var results = generateSubmesh(x, y, z, generator);
            res.end(JSON.stringify(results));
        }
    })
    /*if(storage){
        storage.loader(x, y, z, function(err, data){
            if(err) throw err;
            var results = data || generateSubmesh(x, y, z);
            res.end(JSON.stringify(results));
        });
    }else{
        var results = generateSubmesh(x, y, z);
        res.end(JSON.stringify(results));
    }*/
});
app.post('/chunk/:world/:x/:y/:z', jsonParser, function(req, res){
    var worldName = req.params.world;
    var data = req.body;
    if(storage){
        storage.saver(worldName, data, function(err){
            if(err) throw err;
            res.end(JSON.stringify({success :true}));
        });
    }else res.end(JSON.stringify({success :false}));
});
app.get('/assets/:texturePack/:type', function(req, res){
    var texturePack = req.params.texturePack;
    var type = req.params.type;
    loadTexturePack('./texture-packs/'+texturePack, function(err, pack){
        res.end(JSON.stringify(pack.toTextureList().slice(1)));
    });
});

app.setGeneratorRequestor = function(requestor){
    generatorRequestor = requestor;
};

app.setGenerator = function(generator){
    subgen = generator;
};
app.setStorage = function(sto){
    storage = sto;
};

module.exports = function(generator){
    if(generator) subgen = generator;
    return app;
}

var Storage = {};

Storage.memory = function(){
    var index = {};
    return {
        loader : function(name, x, y, z, cb){
            var key = x+'|'+y+'|'+z;
            return cb(undefined, index[key]);
        },
        saver : function(name, submesh, cb){
            var x = submesh.position[0];
            var y = submesh.position[1];
            var z = submesh.position[2];
            var key = x+'|'+y+'|'+z;
            index[key] = submesh;
            if(cb) cb();
        }
    }
}

Storage.files = function(root){
    return {
        loader : function(name, x, y, z, cb){
            var url = root+'/'+name+'/'+x+'/'+y+'/'+z+'.json';
            fs.exists(url, function(exists){
                if(!exists) return cb(undefined, undefined);
                fs.readFile(url, function(err, data){
                    var parsed = JSON.parse(data);
                    //console.log('data', parsed)
                    if(err) throw err;
                    return cb(undefined, JSON.parse(data));
                });
            });
        },
        saver : function(name, submesh, cb){
            var x = submesh.position[0];
            var y = submesh.position[1];
            var z = submesh.position[2];
            var xDir = root+'/'+name+'/'+x;
            var yDir;
            var next = function(){
                yDir = xDir+'/'+y;
                fs.exists(yDir, function(exists){
                    if(exists) return last();
                    fs.mkdir(yDir, function(err){
                        if(err) throw err;
                        last();
                    })
                });
            }
            var last = function(){
                var file = yDir+'/'+z+'.json';
                fs.writeFile(
                    file,
                    JSON.stringify(submesh, undefined, '  '),
                    function(){
                        if(cb) cb();
                    }
                );
            }
            var first = function(){
                fs.exists(xDir, function(exists){
                    if(exists) return next();
                    fs.mkdir(xDir, function(err){
                        if(err) throw err;
                        next();
                    })
                });
            }
            var worldDir = root+'/'+name+'/';
            fs.exists(worldDir, function(exists){
                if(exists) return first();
                fs.mkdir(worldDir, function(err){
                    if(err) throw err;
                    first();
                })
            });
        }
    }
}

module.exports.Storage = Storage;
