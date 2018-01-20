var Server = require('./server');
var WorldBuilder = require('voxel-biomes');

var builder = new WorldBuilder();
builder.addBiome({
    name : 'material-1',
    rarity : 'common',
    generator : function(subX, subY, subZ, context){
        return function(x, y, z){
            if (y===5) return 1;
            return 0;
        }
    }
});
builder.addBiome({
    name : 'material-2',
    rarity : 'uncommon',
    generator : function(subX, subY, subZ, context){
        return function(x, y, z){
            if (y===5) return 2;
            return 0;
        }
    }
});
builder.addBiome({
    name : 'material-3',
    rarity : 'rare',
    generator : function(subX, subY, subZ, context){
        return function(x, y, z){
            if (y===5) return 3;
            return 0;
        }
    }
});

var app = new Server();
app.use(function (req,res,next) {
    res.header("Access-Control-Allow-Origin", devUrl);
    res.header('Access-Control-Allow-Methods', 'PUT, PATCH, GET, POST, DELETE, OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
app.setGenerator(builder.buildGenerator(WorldBuilder.Segmenters.primes()));
app.setStorage(Server.Storage.memory());
app.listen(8081, function(){
    console.log('Server listening on port 8081.');
});
