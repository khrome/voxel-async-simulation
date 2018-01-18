VoxelSimulation
===============

Experimental!

Not much here yet!

Usage
-----

Here is a reimplementation of [voxel-hello-world](https://github.com/maxogden/voxel-hello-world), but it loads materials based on what it finds in the texture pack and has a different terrain loader (that runs on the server).

	var Simulation = require('voxel-async-simulation');
	var request = require('browser-request');

	var MyGame = new Simulation({
	    chunkLoader : function(placeholderChunk, complete){
	        var url = '/chunk/'+
				placeholderChunk.position[0]+'/'+
	            placeholderChunk.position[1]+'/'+
				placeholderChunk.position[2];
	        request({
	            uri :url,
	            json : true
	        }, function(err, response, data){
	            if(err) throw(err);
	            if(data.error) throw(new Error(
					data.message || (
		                typeof data.error == 'boolean'?
							'Error requesting url:'+url:
							data.error
		            )
				));
	            var results = new Int8Array(32*32*32);
	            var blocks = data.blocks;
	            for(var lcv=0; lcv<results.length; lcv++){
	                results[lcv] = blocks[lcv];
	            }
	            data.blocks = results;
	            complete(undefined, data);
	        })
	    },
	    lookupMaterials : function(texturePack, cb){
	        var url = '/assets/'+texturePack+'/blocks';
	        request({
	            uri :url,
	            json : true
	        }, function(err, response, data){
	            if(err) return cb(err);
	            if(data.blocks){
	                return cb(undefined, data.blocks);
	            }
	            cb(undefined, undefined);
	        })
	    }
	});

then let's wrap the default server in a new file: `server.js`

	require('voxel-async-simulation/server');

then run it:

	node server.js

and access [the html root](http://localhost:8081/index.html)

Testing
-------
Eventually it'll be:

	mocha

Enjoy,

 -Abbey Hawk Sparrow
