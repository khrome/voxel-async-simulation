var express = require('express');
var voxel = require('voxel');
var Generators = require('./voxel-generators');
var group = require('group-by-subsequence');
var primes = require('primes');
var fs = require('fs');

var generator = Generators.intersection(
    Generators.HillyTerrain,
    Generators.Hill
);

var biomes = [];

//var gen = Generators.HillyTerrain;
var gen = function(x, y, z){
    if(y === 0){
        return 1;
    }
    return 0;
};

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
    if(a > 8) return 0;
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
app.get('/chunk/:x/:y/:z', function(req, res){
    var x = req.params.x;
    var y = req.params.y;
    var z = req.params.z;
    //console.log('P', x, y, z);
    var key = x+':'+y+':'+z;
    //*
    if(submeshes[key]){
        return res.end(JSON.stringify(submeshes[key]));
    }//*/
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
    submeshes[key] = results;
    res.end(JSON.stringify(results));
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

var rarities = ['common', 'uncommon', 'rare'];

app.addBiome = function(biome){
    if(!biome) throw new Error('No biome passed');
    if(!biome.name) throw new Error('Biomes require a name');
    if(
        !(biome.generator || biome.generate)
    ) throw new Error('Biomes require a generator');
    if(!biome.rarity) biome.rarity = 'common';
    if(rarities.indexOf(biome.rarity) === -1){
        throw new Error('Unknown rarity:'+biome.rarity);
    }
    if(!this.biomes) this.biomes = {
        common :[],
        uncommon : [],
        rare : []
    };
    this.biomes[biome.rarity].push(biome);
}

var Segmenters = {};

var primes = primes(1000);
var comesAfter = function(item, list){
    var result = -1;
    list.forEach(function(listItem, index){
        if(item > listItem) result = index
    });
    return result;
}

// creates a dense center of rares at world origin
Segmenters.primes = function(x, y, z){
    var xIn = primes.indexOf(x);
    var zIn = primes.indexOf(z);
    var xPos;
    var zPos;
    if(xIn === -1 && zIn === -1){
        xPos = comesAfter(x, primes);
        zPos = comesAfter(z, primes);
        return {
            type : 'common',
            index: Math.max(xPos, zPos)
        }
    }
    if(xIn === -1) return { type : 'uncommon', index: zIn };
    if(zIn === -1) return { type : 'uncommon', index: xIn };
    return {
        type : 'rare',
        index: Math.max(xIn, zIn)
    }
}

Segmenters.modulo = function(x, y, z){

}

var buildBiomesGenerator = function(ob, segmenter){
    var biomes = {
        common : ob.biomes.common,
        uncommon : ob.biomes.uncommon || ob.biomes.common,
        rare : ob.biomes.rare || ob.biomes.uncommon || ob.biomes.common,
    }
    return function(subX, subY, subZ){
        var selection = segmenter(subX, subY, subZ);
        var biomes = biomes[selection.type];
        var index = selection.index % biomes.length; //wraparound
        return biomes[index].generator(subX, subY, subZ, selection);
    }
}

app.setBiomeDistribution = function(algorithm){
    var fn;
    if(typeof algorithm == 'function'){
        fn = algorithm;
    }else{
        if(Segmenters[algorithm]) fn = Segmenters[algorithm]
    }
    if(!fn) throw new Error('No valid algorithm provided');
    subgen = buildBiomesGenerator(app, algorithm);
}

module.exports = function(generator){
    if(generator) subgen = generator;
    return app;
}

module.exports.Segmentors;
