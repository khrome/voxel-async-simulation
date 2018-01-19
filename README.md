VoxelSimulation
===============

Things got much better... it may even be useful now. There are two things this package provides:
- A simple server based loading abstraction
- chunk referencing when generating (which will soon manifest in a biome abstraction)

This means you provide a generator function factory on the server:

    function(chunkX, chunkY, chunkZ){
        //chunk specific work here
        return function(x, y, z){
            //voxel specific work here
        }
    }

Usage
-----

This is a reimagining of [voxel-hello-world](https://github.com/maxogden/voxel-hello-world) that loads materials based on what it finds in the texture pack and has a different terrain loader (which runs on the server). Check out the source of the [example-client](https://github.com/khrome/voxel-async-simulation/example-client.js) until there are more docs. Make sure to either change the client or to name your texturePack `'PhotoRealistic'` so you can use the client with the textures you are about to download.

Speaking of... go [Download a Minecraft texture pack](https://www.planetminecraft.com/resources/texture_packs/) then unpack it and put your textures in a folder at the root called `texture-packs`. If you want you can also drop a `player.png` minecraft skin in the root directory so your avatar is textured.

Now let's build the app(with browserify):

    browserify example-client.js -o app.js

then run the example server:

    node example-server.js

and access [the html root](http://localhost:8081/index.html)

Biomes[TBD]
-----------
Experimental! Untested! Likely to be externalized!

This will produce a flat continuous 1 block thick slab as far as you can run. It will be material 1 in common areas, material 2 in uncommon areas and material 3 in rare areas, and because we pick a prime distribution, uncommon and rare biomes are more infrequent and continuous common areas increase in size as you move outward from the origin. Biomes are alternated in the order they are provided. In addition to hints from the distribution algorithm, `context` contains a deterministic `random()` function for use in generating this submesh, but still being reproducible.

    app.addBiome({
        name : 'material-1',
        rarity : 'common',
        generator : function(subX, subY, subZ, context){
            return function(x, y, z){
                if (y===0) return 1;
                return 0;
            }
        }
    });
    app.addBiome({
        name : 'material-2',
        rarity : 'uncommon',
        generator : function(subX, subY, subZ, context){
            return function(x, y, z){
                if (y===0) return 2;
                return 0;
            }
        }
    });
    app.addBiome({
        name : 'material-3',
        rarity : 'rare',
        generator : function(subX, subY, subZ, context){
            return function(x, y, z){
                if (y===0) return 3;
                return 0;
            }
        }
    });
    app.setBiomeDistribution(Server.Segmenters.prime)

Testing
-------
Eventually it'll be:

    mocha

Enjoy,

 -Abbey Hawk Sparrow
