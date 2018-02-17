var fs = require('fs');
module.exports = function(root){
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
