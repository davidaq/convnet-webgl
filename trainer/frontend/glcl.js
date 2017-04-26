M(async () => {
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl');
  const glcl = {};
  const G = {};
  glcl.init = () => {
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.disable(gl.DEPTH_TEST);

    const vertices = [
      -1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
      -1.0,  1.0,
    ];
    const indicies = [1, 2, 3, 1, 3, 4];
    G.rectPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, G.rectPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    G.rectIndBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.rectIndBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicies), gl.STATIC_DRAW);
    glcl.nonceTexture = gl.createTexture();

    G.passthruVertexShader = glcl.createShader(gl.VERTEX_SHADER, `
      attribute lowp vec2 v_coord;
      varying highp vec2 cursor;
      void main() {
        cursor = v_coord.xy;
        gl_Position = vec4(v_coord.xy, 0, 0);
      }
    `);
  };
  glcl.createShader = (type, code) => {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info + code;
    }
    return shader;
  };
  glcl.createProgram = (binding, code) => {
    const program = gl.createProgram();
    const fragmentShader = glcl.createShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp int;
      precision mediump sampler2D;

      varying highp vec2 cursor;
      uniform highp vec2 step;

      ${Object.keys(binding).map(key =>
        `uniform ${binding[key]} ${key};`
      ).join('')}
      mediump vec4 run() {
        ${code}
      }
      void main() {
        gl_FragColor = run();
      }
    `);
    gl.attachShader(program, G.passthruVertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vCoordLoc = gl.getAttribLocation(program, 'v_coord');
    const cursorLoc = gl.getUniformLocation(program, 'cursor');
    const stepLoc = gl.getUniformLocation(program, 'step');
    let textureCounter = 0;
    const bindingInfo = {};

    Object.keys(binding).forEach(key => {
      const info = {};
      bindingInfo[key] = info;
      info.loc = gl.getUniformLocation(program, 'cursor');
      info.type = binding[key].split(' ').pop();
      if (info.type === 'sampler2D') {
        textureCounter++;
        info.texIndex = textureCounter;
        info.texIndexEnum = gl[`TEXTURE${textureCounter}`];
      }
    });
    gl.enableVertexAttribArray(vCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, G.rectPosBuffer);
    gl.vertexAttribPointer(vCoordLoc, 2, gl.FLOAT, false, 0, 0);

    return (output, input) => {
      // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer);
      // gl.activeTexture(gl.TEXTURE0);
      // gl.bindTexture(gl.TEXTURE_2D, output.texture);
      gl.viewport(0, 0, output.width, output.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      Object.keys(input).forEach(key => {
        const info = bindingInfo[key];
        const val = input[key];
        switch (info.type) {
          case 'sampler2D':
            gl.uniform1i(info.loc, info.texIndex);
            gl.activeTexture(info.texIndexEnum);
            gl.bindTexture(gl.TEXTURE_2D, val.texture);
            break;
          case 'float':
            gl.uniform1f(info.loc, val);
            break;
          case 'vec2':
            gl.uniform2fv(info.loc, val);
            break;
          case 'vec3':
            gl.uniform3fv(info.loc, val);
            break;
          case 'vec4':
            gl.uniform4fv(info.loc, val);
            break;
        }
      });
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    };
  };
  glcl.Vol = class {
    constructor(width, height, depth) {
      this.width = width;
      this.height = height;
      this.widthPOT = glcl.nearestPOT(width);
      this.heightPOT = glcl.nearestPOT(height);
      this.depth = depth;
      this.framebuffer = gl.createFramebuffer();
      this.texture = gl.createTexture();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.widthPOT, this.heightPOT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      // this.renderbuffer = gl.createRenderbuffer();
      // gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
      // gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderbuffer);
    }
    set(data) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
    get() {
      const out = new Uint8Array(this.width * this.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, out, 0);
      return out;
    }
  };
  glcl.nearestPOT = (num) => {
    let ret = 1;
    while (ret < num) {
      ret *= 2;
    }
    return ret;
  };
  return glcl;
});
