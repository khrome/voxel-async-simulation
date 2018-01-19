var Server = require('./server');
var Generators = require('./voxel-generators');

var app = new Server(
    function(subX, subY, subZ){
        return function(x, y, z){
            if(subY % 5 == 0){
                return Generators.HillyTerrain(x, y, z);
            }
            return 0;
        }
    }
);
app.listen(8081, function(){

});
