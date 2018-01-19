var VoxelSimulation = require('./voxel-simulation-async');

VoxelSimulation.Client({
    texturePack : 'PhotoRealistic',
    materialsOrdering : ['nether_brick', 'grass', 'stone_slab', 'stone_brick'].reverse()
});
