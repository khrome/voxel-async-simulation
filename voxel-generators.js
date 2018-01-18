var voxel = require('voxel');

function intersectGenerators(a, b, resolve){
    return function(x, y, z){
        var resA = a(x, y, z);
        var resB = b(x, y, z);
        if(resA && resB) return resolve?
            resolve(resA, resB, x, y, z):
            (resA > resB?resA:resB);

    }
}

//Sphere, Noise, DenseNoise, Checker, Hill, Valley, HillyTerrain
var Generators = voxel.generator;
Generators.DenseNoise = Generators['Dense Noise'];
delete Generators['Dense Noise'];
Generators.HillyTerrain = Generators['Hilly Terrain'];
delete Generators['Hilly Terrain'];
Generators.intersection = intersectGenerators;

module.exports = Generators;
