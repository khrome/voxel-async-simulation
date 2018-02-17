module.exports = function(){
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
