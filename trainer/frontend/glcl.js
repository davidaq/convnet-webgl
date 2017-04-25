Define(async () => {
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl');
  const glcl = {};
  const G = {};
  glcl.init = () => {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.disable(gl.DEPTH_TEST);

    const vertices = [
      -1.0, -1.0, 0,
      -1.0, 1.0, 0,
      1.0, 1.0, 0,
      -1.0, 1.0, 0,
    ];
    const indicies = [1, 2, 3, 1, 3, 4];
    G.rectPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, G.rectPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    G.rectIndBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.rectIndBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicies), gl.STATIC_DRAW);

    G.passthruVertexShader = glcl.createShader(gl.VERTEX_SHADER, `
      attribute vec3 v_pos;
      void main() {
        gl_Position = v_pos;
      }
    `);
  };
  glcl.createShader = (type, code) => {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info;
    }
    return shader;
  };
  glcl.createProgram = (code, binding) => {
    const program = gl.createProgram();
    const fragmentShader = glcl.createShader(gl.FRAGMENT_SHADER, code);
    gl.attachShader(program, G.passthruVertexShader);
    gl.attachShader(program, fragmentShader);

    gl.getAttribLocation(program, 'v_pos');
    return (input, output) => {
      binding(...args);
      gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer);
      gl.viewport(0, 0, output.width, output.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.rectPosBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.rectIndBuffer);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  };
  glcl.createVol = (width, height, depth) => {
    const vol = { width, height, depth };
    vol.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, vol.framebuffer);
    // vol.framebuffer.width = width;
    // vol.framebuffer.height = height;
    vol.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, vol.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // vol.renderbuffer = gl.createRenderbuffer();
    // gl.bindRenderbuffer(gl.RENDERBUFFER, vol.renderbuffer);
    // gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, vol.texture, 0);
    // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, vol.renderbuffer);
    vol.bind = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, vol.framebuffer);
    };
    return vol;
  };
  return glcl;
});
