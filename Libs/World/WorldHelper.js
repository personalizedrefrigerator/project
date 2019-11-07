/**
 *  A class to manage/handle the creation and
 * management of worlds related to the game
 * portion of this application.
 */

function World(options)
{
    const me = this;
    
    // Initialize with the renderer.
    this.terrainGenerator = options.terrainGenerator 
            || TerrainHelper.getCubeTerrainGenerator(options.renderer);
    
    this.tick = function(deltaT)
    {
        
    };
    
    this.render = function(renderer)
    {
        
    };
}

const WorldHelper = {};
WorldHelper.createBasicWorld = (renderer) =>
{
    let options = 
    {
        renderer: renderer
    };

    return new World(options);
};
