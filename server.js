var express = require('express');
var bodyParser = require('body-parser');
var voxel = require('voxel');
var Generators = require('voxel-generators');
var group = require('group-by-subsequence');
var primes = require('primes');
var fs = require('fs');

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

function generateSubmesh(x, y, z){
    var data = [];
    var xOff = 32 * 32;
    yOff = 32;
    var xPart;
    var yPart;
    var gen = subgen(x, y, z);
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

app.get('/chunk/:world/:x/:y/:z', function(req, res){
    var x = req.params.x;
    var y = req.params.y;
    var z = req.params.z;
    var results = generateSubmesh(x, y, z);
    if(storage){
        storage.loader(x, y, z, function(err){
            if(err) throw err;
            res.end(JSON.stringify(results));
        });
    }else res.end(JSON.stringify(results));
});
app.post('/chunk/:world/:x/:y/:z', jsonParser, function(req, res){
    var data = req.body;
    if(storage){
        storage.saver(data, function(err){
            if(err) throw err;
            res.end(JSON.stringify({success :true}));
        });
    }else res.end(JSON.stringify({success :false}));
});
app.get('/assets/:texturePack/:type', function(req, res){
    var texturePack = req.params.texturePack;
    var type = req.params.type;
    if(lookups[texturePack] && lookups[texturePack][type]){
        res.end(JSON.stringify(lookups[texturePack][type]));
        return;
    }
    fs.readdir(
        process.cwd()+
        '/texture-packs/'+
        texturePack+
        '/assets/minecraft/textures/'+type, function(err, list){
            var result = group(list, {
                stopwords : [
                    'log', 'rail', 'trip', 'sapling', 'leaves',
                    'mushroom', 'nether', 'bed'
                ],
                replacements : {
                    png : 'side'
                },
                wordBoundary : '_',
                objectReturn : function(s, prefix){
                    return s.substring(prefix.length).split('.').shift();
                }
            });
            var output = { };
            output[type] = result;
            if(!lookups[texturePack]) lookups[texturePack] = {};
            lookups[texturePack][type] = output;
            res.end(JSON.stringify(output));
        }
    );
});

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
        loader : function(x, y, z, cb){
            var key = x+'|'+y+'|'+z;
            return cb(undefined, index[key]);
        },
        saver : function(submesh, cb){
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
        loader : function(x, y, z, cb){
            var url = root+'/'+x+'/'+y+'/'+z+'.json';
            fs.exists(url, function(exists){
                console.log('exists', exists)
                if(!exists) return cb(undefined, undefined);
                fs.read(url, function(err, data){
                    console.log('data', data)
                    if(err) throw err;
                    return cb(undefined, JSON.parse(data));
                });
            });
        },
        saver : function(submesh, cb){
            var x = submesh.position[0];
            var y = submesh.position[1];
            var z = submesh.position[2];
            var xDir = root+'/'+x;
            var next = function(){
                var yDir = xDir+'/'+y;
                fs.exists(yDir, function(exists){
                    if(exists) last();
                    fs.mkdir(yDir, function(err){
                        if(err) throw err;
                        last();
                    })
                });
            }
            var last = function(){
                fs.write(
                    yDir+'/'+z+'.json',
                    JSON.stringify(submesh, undefined, '  '),
                    function(){
                        if(cb) cb();
                    }
                );
            }
            fs.exists(xDir, function(exists){
                if(exists) next();
                fs.mkdir(xDir, function(err){
                    if(err) throw err;
                    next();
                })
            });
        }
    }
}

module.exports.Storage = Storage;
