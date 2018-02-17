var fs = require('fs');
var Dat = require('dat-node');

var activeDats = {};

var newDat = function(path, cb){
    if(activeDats[path]) return cb(undefined, activeDats[path]);
    Dat(path, function (err, dat) {
        if (err) throw err
        dat.importFiles()
        dat.joinNetwork()
        activeDats[path] = dat;
        console.log('My Dat link is: dat://', dat.key.toString('hex'))
        cb(undefined, dat);
    })
}

var existingDat = function(path, key, cb){
    if(activeDats[path]) return cb(undefined, activeDats[path]);
    Dat(path, {
        key: key
    }, function (err, dat) {
        if (err) throw err;
        activeDats[path] = dat;
        //todo: preload config and start cube
        dat.joinNetwork();
        cb(undefined, dat);
    })
}

module.exports = function(root){
    var fetchDat = function(name, cb){
        var url = root+'/'+name+'/world.json';
        if(activeDats[root+'/'+name]) return cb(undefined, activeDats[root+'/'+name]);
        fs.exists(url, function(exists){
            if(!exists){
                return newDat(root+'/'+name, function(err, dat){
                    cb(undefined, dat);
                });
            }else{
                fs.readFile(url, function(err, body){
                    var data = JSON.parse(body);
                    return existingDat(root+'/'+name, function(err, dat){
                        cb(undefined, dat);
                    });
                })
            }
        });
    }
    return {
        id : function(){
            cb(undefined, activeDats[root+'/'+name].);
        },
        loader : function(name, x, y, z, cb){
            var url = root+'/'+name+'/'+x+'/'+y+'/'+z+'.json';
            fetchDat(name, function(err, dat){
                fs.exists(url, function(exists){
                    if(!exists) return cb(undefined, undefined);
                    fs.readFile(url, function(err, data){
                        var parsed = JSON.parse(data);
                        //console.log('data', parsed)
                        if(err) throw err;
                        return cb(undefined, JSON.parse(data));
                    });
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
            fetchDat(name, function(err, dat){
                var worldDir = root+'/'+name+'/';
                fs.exists(worldDir, function(exists){
                    if(exists) return first();
                    fs.mkdir(worldDir, function(err){
                        if(err) throw err;
                        first();
                    })
                });
            })
        }
    }
}
