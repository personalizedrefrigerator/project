"use strict";

function Renderer()
{
    var me = this;

    me.objects = {};

    me.storeObject = (objectId, object) =>
    {
        me.objects[Math.floor(objectId * 30)] = object;
    };

    me.retrieveObject = (objectId) =>
    {
        return me.objects[Math.floor(objectId * 30)];
    };

    let lastObjectId = 1;
    function ObjectData(vertexAttribs, specificAttributeData)
    {
        var parent = me;

        this.vao = vertexAttribs; // The vertex attribute array.
        this.specificAttributeData = specificAttributeData;
        this.numTriangles = 0; // The number of triangles to render.
        this.state = {}; // Any user-set information. E.g. a label.

        lastObjectId += 0.1;
        this.id = 0.95 / lastObjectId + 0.05; // Set the object's id.

        me.storeObject(this.id, this);
    }

    ObjectData.prototype.bufferData = function(attrName, data)
    {
        const buffer = this.specificAttributeData[attrName].buffer;

        me.gl.bindVertexArray(this.vao);
        me.gl.bindBuffer(me.gl.ARRAY_BUFFER, buffer);

        let bufferObject;

        if (data.length > 0 && typeof data[0] === "number")
        {
            bufferObject = new Float32Array(data);
        }
        else if (data.length > 0 && data[0].IS_VECTOR)
        {
            bufferObject = ModelHelper.vectorArrayToFloat32Array(data);
        }

        me.gl.bufferData(me.gl.ARRAY_BUFFER, bufferObject, me.gl.STATIC_DRAW);

        // Note the number of triangles to be rendered for this object.
        if (attrName === "a_position")
        {
            this.numTriangles = Math.floor(data.length / me.attributes["a_position"]);

            console.log("NUM_TRIANGLES: " + this.numTriangles);
        }

        console.log("GIVEN: " + attrName + ": " + data.length);
    };

    ObjectData.prototype.bindBuffers = function()
    {
        me.gl.bindVertexArray(this.vao);
    };

    // Store information associated with an object.
    ObjectData.prototype.attachState = function(key, newState)
    {
        this.state[key] = newState;
    };

    // Retrieve information associated with an object.
    ObjectData.prototype.retrieveState = function(key)
    {
        return this.state[key];
    };

    me.fovY = 70.0; // A 70.0 degree field of view.
    let lookAtPoint = new Vector3(0, 0, 0);
    let lookAtUpDirection = new Vector3(0, 0, 1);
    let cameraPosition = new Vector3(0, 0, 405);
    let lightPosition = new Vector3(1, -36, 800);

    me.zMin = 1;
    me.zMax = 4000;

    me.outputCanvas = document.createElement("canvas");
    me.gl = me.outputCanvas.getContext("webgl2");

    me.backgroundCanvas = document.createElement("canvas");
    me.backgroundCtx = me.backgroundCanvas.getContext("2d");

    me.uniforms = 
    {
       "u_shine": {},
       "u_worldMatrix": {},
       "u_worldInverseTranspose": {},
       "u_viewMatrix": {},
       "u_cameraMatrix": {},

       "u_cameraPosition": {},
       "u_lightPosition": {},
       "u_mousePosition": {},
       "u_objectId": {},
       "u_fogDecay": {},
       "u_fogColor": {}
    };

    me.attributes =
    {
        "a_position": 3,
        "a_normal": 3,
        "a_color": 3,
        "a_texCoord": 2
    };

    const vertexShaderSource =
    `#version 300 es
    
    in vec4 a_position;
    in vec3 a_normal;
    in vec3 a_color;
    in vec2 a_texCoord;

    uniform mat4 u_worldMatrix;
    uniform mat4 u_worldInverseTranspose; // For normal calculation with stretched objects.
    uniform mat4 u_viewMatrix;
    uniform mat4 u_cameraMatrix;

    uniform vec3 u_cameraPosition;
    uniform vec3 u_lightPosition;
    uniform vec2 u_mousePosition;

    out vec3 v_color;
    out vec3 v_toCamera;
    out vec3 v_toLight;
    out vec3 v_normal;
    out vec2 v_texCoord;
    out vec2 v_mousePosition;

    void main()
    {
        gl_Position = u_viewMatrix * u_cameraMatrix * u_worldMatrix * a_position;

        vec4 worldPosition = u_worldMatrix * a_position;

        v_color = a_color;
        v_toLight = (vec4(u_lightPosition, 1.0) - worldPosition).xyz;
        v_toCamera = (vec4(u_cameraPosition, 1.0) - worldPosition).xyz;

        v_normal = mat3(u_worldInverseTranspose) * a_normal.xyz; // TODO: Review the math for this.

        v_texCoord = a_texCoord;
        v_mousePosition = u_mousePosition;
    }
    `;

    const fragmentShaderSource = 
    `#version 300 es
    
    precision highp float;

    uniform float u_shine;
    uniform sampler2D u_texture;
    uniform float u_objectId;
    uniform float u_fogDecay;
    uniform vec3 u_fogColor;

    in vec3 v_color;
    in vec3 v_toLight;
    in vec3 v_toCamera;
    in vec3 v_normal;
    in vec2 v_texCoord;
    in vec2 v_mousePosition;

    out vec4 color;

    void main()
    {
        vec2 toMouse = gl_FragCoord.xy - v_mousePosition;

        if (toMouse.x < 3.0 && toMouse.x >= -1.0 && abs(toMouse.y) < 4.0)
        {
            color = vec4(v_texCoord.x, v_texCoord.y, u_objectId, 1.0);

            return;
        }
        else if (toMouse.x < -1.1 && toMouse.x > -5.0 && abs(toMouse.y) < 3.0)
        {
            color = vec4(0.0, 1.0, 0.0, 1.0);

            return;
        }

        vec3 resultantColor = (v_color + texture(u_texture, v_texCoord).xyz) / 2.0; // vec3(v_texCoord.x, 0, v_texCoord.y);

        vec3 normal = normalize(v_normal);
        vec3 toLight = normalize(v_toLight);
        vec3 toCamera = normalize(v_toCamera);
        
        vec3 halfVector = normalize(toLight + toCamera); // The vector between the light and camera.
                                                         //This vector's angle from the camera determines
                                                         //the specular lighting amount.

        float lighting = dot(normal, toLight); // By Lambert's Cosine Law.

        float specular = dot(halfVector, toCamera);

        // If specular lighting should be applied,
        //make it bright!
        if (lighting > 0.0 && specular > 0.0)
        {
            specular = pow(specular, u_shine);
        }
        else
        {
            specular = 0.0;
        }

        resultantColor += specular;
        resultantColor *= lighting;

        float fogAmount = pow((gl_FragCoord.z + 1.0) / 2.0, u_fogDecay);

        resultantColor = resultantColor * (1.0 - fogAmount) + u_fogColor * fogAmount;

        color = vec4(resultantColor, 1.0);
    }
    `;

    const compileShader = (shaderSource, shaderType) =>
    {
        const shader = me.gl.createShader(shaderType);

        me.gl.shaderSource(shader, shaderSource);

        me.gl.compileShader(shader);

        // Check compile status.
        if (me.gl.getShaderParameter(shader, me.gl.COMPILE_STATUS))
        {
            return shader; // Return the shader on successful compile.
        } // On error,
        else
        {
            // Get the error message.
            const errorMessage = me.gl.getShaderInfoLog(shader);

            // Delete the shader.
            me.gl.deleteShader(shader);

            // Inform the user (or probably just the programmer
            //who is debugging this).
            throw errorMessage;
        }
    };

    const linkProgram = (vertexShader, fragmentShader) =>
    {
        const program = me.gl.createProgram();

        me.gl.attachShader(program, vertexShader);
        me.gl.attachShader(program, fragmentShader);

        me.gl.linkProgram(program); // Link the shaders into a program.

        // Check whether the linking was successful.
        if (me.gl.getProgramParameter(program, me.gl.LINK_STATUS))
        {
            return program; // The program was linked successfully.
        }
        else
        { // Otherwise, inform whoever is debugging the program (or a catch statement)
            // of the error by throwing it.
            const errorText = me.gl.getProgramInfoLog(program);

            // Remove the program (RAII).
            me.gl.deleteProgram(program);

            // Throw the error.
            throw errorText;
        }
    };

    const makeTexture = () =>
    {
        let texture = me.gl.createTexture();

        me.gl.bindTexture(me.gl.TEXTURE_2D, texture);

        // Disable mip-mapping.
        //Note that the S and T notation is from the use of
        //s, t, u, v, for x, y, z, w when using textures.
        //This is why many call texture coordinates "UVs."
        me.gl.texParameteri(me.gl.TEXTURE_2D, me.gl.TEXTURE_WRAP_S, me.gl.CLAMP_TO_EDGE); // Don't tile (x direction).
        me.gl.texParameteri(me.gl.TEXTURE_2D, me.gl.TEXTURE_WRAP_T, me.gl.CLAMP_TO_EDGE); // Y-direction.

        // Just use the nearest mip (there should only be one.
        me.gl.texParameteri(me.gl.TEXTURE_2D, me.gl.TEXTURE_MAG_FILTER, me.gl.NEAREST);
        me.gl.texParameteri(me.gl.TEXTURE_2D, me.gl.TEXTURE_MIN_FILTER, me.gl.NEAREST);
    };

    // Compile and link the program to be used
    //by the renderer.
    const makeProgram = () =>
    {
        const vertexShader = compileShader(vertexShaderSource, me.gl.VERTEX_SHADER);
        const fragmentShader = compileShader(fragmentShaderSource, me.gl.FRAGMENT_SHADER);
        
        const program = linkProgram(vertexShader, fragmentShader);

        me.program = program;

        me.gl.useProgram(program);

        return true;
    };

    // Find the locations of the uniforms
    const findUniforms = () =>
    {
        for (var uniformName in me.uniforms)
        {
            me.uniforms[uniformName] =
            {
                location: me.gl.getUniformLocation(me.program, uniformName)
            };
        }
    };

    // Update a uniform's value. Note: If the 
    //uniform does not exist, this can throw an error.
    const updateUniform = (name, newValue) =>
    {
        if (typeof name === "string") // If a map key.
        {
            me.uniforms[name].setTo(newValue);
        }
        else // If an entry in the map...
        {
            name.setTo(newValue);
        }
    };

    const setUp = () =>
    {
        var gl = me.gl;

        makeProgram();
        findUniforms();

        makeTexture();

        const handleUniform = (name, setFunction, defaultValue, transformInput) =>
        {
            transformInput = transformInput || ((input) => input);

            me.uniforms[name].setTo = (newValue) =>
            {
                setFunction.call(me, me.uniforms[name].location, transformInput(newValue));
            };

            if (defaultValue)
            {
                me.uniforms[name].setTo(defaultValue);
            }
        };

        me.worldMatrix = new Mat44();
        me.worldMatrix.rightMulTransform = false;

        me.cameraMatrix = new Mat44();
        me.viewMatrix = new Mat44();

        me.worldMatrix.toIdentity();
        me.cameraMatrix.toIdentity();
        me.viewMatrix.toIdentity();


        handleUniform("u_shine", (location, setTo) => gl.uniform1f(location, setTo), 50000.0);

        const generalMatrixSetFunction = (location, values) => gl.uniformMatrix4fv(location, true, values); // DO transpose.
        const matrixTransformInput = (input) => input.getArray();

        handleUniform("u_worldMatrix", generalMatrixSetFunction,
                me.worldMatrix, matrixTransformInput);
        
        handleUniform("u_cameraMatrix", generalMatrixSetFunction,
                me.cameraMatrix, matrixTransformInput);

        handleUniform("u_viewMatrix", generalMatrixSetFunction,
                me.viewMatrix, matrixTransformInput);

        handleUniform("u_worldInverseTranspose", (location, values) => gl.uniformMatrix4fv(location, false, values), // Do NOT transpose.
                me.worldMatrix.getInverse(), matrixTransformInput);

        const vector3SetFunction = (location, values) => gl.uniform3fv(location, values);
        const vector2SetFunction = (location, values) => gl.uniform2fv(location, values);

        const vector3TransformInput = (values) => [values.x, values.y, values.z];
        const vector2TransformInput = (values) => [values.x, values.y];

        handleUniform("u_cameraPosition", vector3SetFunction, cameraPosition, vector3TransformInput);
        handleUniform("u_lightPosition", vector3SetFunction, lightPosition, vector3TransformInput);
        handleUniform("u_mousePosition", vector2SetFunction, undefined, vector2TransformInput);
        handleUniform("u_objectId", (location, value) => gl.uniform1f(location, value));
        handleUniform("u_fogDecay", (location, value) => gl.uniform1f(location, value), 10000.0); // Set the default fog amount.
        handleUniform("u_fogColor", vector3SetFunction, new Vector3(0, 0, 0), vector3TransformInput);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        me.updateViewIfNeeded(100, 100, true);

        me.setCameraPosition(0, 0, 405);
        me.setLookAtLocation(12, 0, 10);
        

        me.updateCamera();
    };

    const resizeBackgroundCanvasIfNecessary = () =>
    {
        if (me.backgroundCanvas.width !== me.outputCanvas.width
            || me.backgroundCanvas.height !== me.outputCanvas.height)
        {
            me.backgroundCanvas.width = me.outputCanvas.width;
            me.backgroundCanvas.height = me.outputCanvas.height;

            return true;
        }

        return false;
    };

    me.registerObject = () =>
    {
        var gl = me.gl;

        // Stores data associated with the object.
        const vertexAttribsCollection = gl.createVertexArray();
        gl.bindVertexArray(vertexAttribsCollection);

        let specificAttributeData = {};

        const handleAttr = (name, size) =>
        {
            specificAttributeData[name] = {};

            const location = gl.getAttribLocation(me.program, name);
            const buffer = gl.createBuffer();

            specificAttributeData[name].location = location;
            specificAttributeData[name].buffer = buffer;

            // We will be using this buffer, for now.
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

            // Enable it.
            gl.enableVertexAttribArray(location);

            console.log (name + ": " + size);

            // Tell WebGL how to retrieve data from this buffer,
            //we assume it contains floats.
            gl.vertexAttribPointer(location, size, // size elements/calling.
                    gl.FLOAT,
                    false, // We're not going to normalize.
                    0, 0); // No stride and no offset.

            // We buffer the data when the client requests it.
        };

        for (var attributeName in me.attributes)
        {
            handleAttr(attributeName, me.attributes[attributeName]);
        }

        // Allow rapid switching between objects.
        return new ObjectData(vertexAttribsCollection, specificAttributeData);
    };

    // Set the clear and fog colors. Takes a vec3.
    me.setFogColor = (newColor) =>
    {
        updateUniform(me.uniforms.u_fogColor, newColor);
        me.gl.clearColor(newColor.x, newColor.y, newColor.z, 1.0);
    };

    // Change how rapidly objects moving into the background
    //become obscured by a fog. Greater input, more sudden
    //change. Note: This depends on the maximum z.
    me.setFogDecay = (newFogDecay) =>
    {
        updateUniform(me.uniforms.u_fogDecay, newFogDecay);
    };

    me.setTexture = (image) =>
    {
        me.gl.texImage2D(me.gl.TEXTURE_2D, 0, // level
            me.gl.RGBA, // Internal format
            me.gl.RGBA, // External format
            me.gl.UNSIGNED_BYTE, // Data type
            image);
    };

    const setObjectId = (objectData) =>
    {
        updateUniform(me.uniforms.u_objectId, objectData.id);
    };

    me.setMousePosition = (position) =>
    {
        updateUniform(me.uniforms.u_mousePosition, position);
    };

    /*
        Get information about the objects interacting with
        the mouse. 
        Pre: setMousePosition was called before the last
            render.
        Post: Some information about the mouse's position
            is returned. Note that performance has been
            traded for reliability -- this method is
            not reliable.
    */
    me.getMouseAttributes = () =>
    {
        resizeBackgroundCanvasIfNecessary();

        me.display(me.backgroundCtx);

        var imageData = me.backgroundCtx.getImageData(0, 0, me.backgroundCanvas.width, me.backgroundCanvas.height);
        var data = imageData.data; // The raw data to be searched.
        var countPrior = 0;

        var result = {};

        for (var i = 0; i < data.length; i += 4)
        {
            if (data[i] <= 1 && data[i + 1] >= 254 && data[i + 2] <= 1)
            {
                countPrior ++;
            }
            else if (countPrior > 2 && data[i + 2] > 10)
            {
                result.texCoordX = data[i] / 256;
                result.texCoordY = data[i + 1] / 256;
                result.objectId = data[i + 2] / 256;

                result.selectedObject = me.retrieveObject(result.objectId);

                break;
            }
            else
            {
                countPrior --;

                countPrior = Math.max(countPrior, 0);
            }
        }

        return result;
    };

    me.setCameraPosition = function(x, y, z)
    {
        // If given a vector3, handle it.
        if (typeof x === "object")
        {
            cameraPosition.x = x.x;
            cameraPosition.y = x.y;
            cameraPosition.z = x.z;
        }
        else
        {
            cameraPosition = new Vector3(x, y, z);
        }

        updateUniform(me.uniforms.u_cameraPosition, cameraPosition);
    };

    me.setLightPosition = function(x, y, z)
    {
        if (typeof x === "object")
        {
            lightPosition.x = x.x;
            lightPosition.y = x.y;
            lightPosition.z = x.z;
        }
        else
        {
            lightPosition = new Vector3(x, y, z);
        }

        updateUniform(me.uniforms.u_lightPosition, lightPosition);
    }

    me.setLookAtLocation = function(x, y, z)
    {
        // TODO: Remove code duplication with
        //setCameraPosition.
        if (typeof x === "object")
        {
            lookAtPoint.x = x.x;
            lookAtPoint.y = x.y;
            lookAtPoint.z = x.z;
        }
        else
        {
            lookAtPoint = new Vector3(x, y, z);
        }
    };

    me.updateCamera = function()
    {
        me.cameraMatrix = Mat44Helper.createLookAtMatrix(cameraPosition, lookAtPoint, lookAtUpDirection);

        updateUniform(me.uniforms.u_cameraMatrix, me.cameraMatrix);
    };

    me.updateViewIfNeeded = (width, height, force) =>
    {
        var gl = me.gl;

        if (me.outputCanvas.width !== width || me.outputCanvas.height !== height || force)
        {
            me.outputCanvas.width = width;
            me.outputCanvas.height = height;

            var aspect = gl.drawingBufferHeight / gl.drawingBufferWidth;
            var fovY = me.fovY / 180.0 * Math.PI;
            
            me.viewMatrix = Mat44Helper.frustumViewMatrix(aspect, fovY, me.zMin, me.zMax);
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

            updateUniform(me.uniforms.u_viewMatrix, me.viewMatrix);
        }
    };

    me.setZMax = (newZMax) =>
    {
        me.zMax = newZMax;

        me.updateViewIfNeeded(me.outputCanvas.width, me.outputCanvas.height, true);
    };

    me.updateWorldMatrix = () =>
    {
        updateUniform(me.uniforms.u_worldMatrix, me.worldMatrix);
        updateUniform(me.uniforms.u_worldInverseTranspose, me.worldMatrix.getInverse());
    };

    me.render = function(objectData)
    {
        objectData.bindBuffers();
        setObjectId(objectData);

        me.gl.drawArrays(me.gl.TRIANGLES, 0, objectData.numTriangles);
    };

    me.clear = function()
    {
        me.gl.clear(me.gl.COLOR_BUFFER_BIT | me.gl.DEPTH_BUFFER_BIT);
    };

    me.display = function(ctx2D)
    {
        ctx2D.drawImage(me.gl.canvas, 0, 0);
    };

    setUp();
}