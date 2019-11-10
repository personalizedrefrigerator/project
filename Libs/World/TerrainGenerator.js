"use strict";

/**
 *  An object to generate terrain for a game.
 * this object is intended to be extended for
 * future use.
 */

function TerrainGenerator(renderer)
{
    this.terrain = {};
    this.renderer = renderer;

    // Initialize the object with which the 
    //entire terrain will be drawn.
    this.terrainObject = this.renderer.registerObject();
    this.terrainObject.bufferData("a_normal", ModelHelper.Objects.Cube.getNormals());
    this.terrainObject.bufferData("a_position", ModelHelper.Objects.Cube.getVerticies());
    this.terrainObject.bufferData("a_texCoord", ModelHelper.Objects.Cube.getTexCoords());
    this.terrainObject.bufferData("a_color", JSHelper.getArrayOfRandomColors(
        ModelHelper.Objects.Cube.getVerticies().length,
        false, 3, 0.0, 0.2, 0.0, 0.1, 0.0, 0.1));

    // Render a chunk at a given position.
    this.renderAt = function(x, z)
    {
        let currentChunk = this.terrain["(" + x + ", " + z + ")"];

        // Have we selected a block for this position before?
        if (!currentChunk)
        {
            this.terrain["(" + x + ", " + z + ")"] = {};
            currentChunk = this.terrain["(" + x + ", " + z + ")"];

            currentChunk.y = Math.random() * 10;
            currentChunk.color = new Vector3(Math.random(), Math.random(), Math.random());
        }

        this.renderer.worldMatrix.save();

        this.renderer.setTint(currentChunk.color);

        this.renderer.worldMatrix.translate([x, currentChunk.y, z]);
        this.renderer.updateWorldMatrix();

        this.renderer.render(this.terrainObject);

        this.renderer.worldMatrix.restore();
    };
}
