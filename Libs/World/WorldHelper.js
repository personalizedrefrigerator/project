"use strict";

/**
 *  A class to manage/handle the creation and
 * management of worlds related to the game
 * portion of this application.
 */

function World(options)
{
    const me = this;
    me.renderer = options.renderer;
    
    // Initialize with the renderer.
    this.terrainGenerator = options.terrainGenerator 
            || new TerrainGenerator(options.renderer);
    
    this.tick = function(deltaT)
    {
        
    };
    
    this.render = function()
    {
        for (let x = 0; x < 10; x++)
        {
            for (let y = 0; y < 10; y++)
            {
                this.terrainGenerator.renderAt(x * 50, y * 50);
            }
        }
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
