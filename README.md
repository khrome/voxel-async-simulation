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

Biomes
-----------
Using [voxel-biomes](https://www.npmjs.com/package/voxel-biomes) you can support biomes as a series of different generators. See an example of this in the [source](https://github.com/khrome/voxel-async-simulation/example-biome-server.js). To execute this inside this project, you need to manually `npm install voxel-biomes`;

Testing
-------
Eventually it'll be:

    mocha

Enjoy,

 -Abbey Hawk Sparrow
