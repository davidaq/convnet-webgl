M(async () => {
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl');
  const glcl = {};
  const G = {};
  glcl.init = () => {
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.disable(gl.DEPTH_TEST);
    gl.getExtension('OES_texture_float');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const vertices = [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ];
    const indicies = [1, 2, 3, 1, 3, 4];
    G.rectPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, G.rectPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    G.rectIndBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.rectIndBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicies), gl.STATIC_DRAW);
    glcl.nonceTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glcl.nonceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.FLOAT, null);

    G.passthruVertexShader = glcl.createShader(gl.VERTEX_SHADER, `
      attribute mediump vec2 v_coord;
      varying highp vec2 f_outpos;
      void main() {
        f_outpos = v_coord;
        gl_Position = vec4(v_coord.xy * 2.0 - 1.0, 0.0, 1.0);
      }
    `);
  };
  glcl.createShader = (type, code) => {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info + '\n'
        + code.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
    }
    return shader;
  };
  glcl.createProgram = (binding, code) => {
    let textureCounter = 0;
    const bindingInfo = {};
    const uniforms = [];
    Object.keys(binding).forEach(key => {
      const bindingDecl = binding[key];
      const info = {};
      bindingInfo[key] = info;
      info.type = bindingDecl.split(' ').pop();
      if (info.type === 'vol') {
        textureCounter++;
        info.texIndex = textureCounter;
        info.texIndexEnum = gl[`TEXTURE${textureCounter}`];
        uniforms.push({ key: `voltex_${key}`, bind: loc => info.loc = loc });
        uniforms.push({ key: `voldim_${key}`, bind: loc => info.dimLoc = loc });
        info.decl = `
          uniform mediump vec4 voldim_${key};
          uniform sampler2D voltex_${key};
          mediump vec4 ${key} (vec2 pxpos) {
            return texture2D(voltex_${key}, voldim_${key}.zw * (pxpos + 0.5));
          }
        `;
      } else {
        uniforms.push({ key, bind: loc => info.loc = loc });
        info.decl = `uniform ${bindingDecl} ${key};`;
      }
    });

    const program = gl.createProgram();
    const fragmentShader = glcl.createShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp int;
      precision mediump sampler2D;

      varying highp vec2 f_outpos;
      uniform mediump vec4 f_outdim;

      ${Object.keys(binding).map(key => bindingInfo[key].decl).join('')}
      mediump vec4 run(vec2 outpos) {
        ${code}
      }
      void main() {
        vec2 outpos = f_outpos * f_outdim.xy - 0.5;
        gl_FragColor = run(outpos);
      }
    `);
    gl.attachShader(program, G.passthruVertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vCoordLoc = gl.getAttribLocation(program, 'v_coord');
    const outdimLoc = gl.getUniformLocation(program, 'f_outdim');
    gl.enableVertexAttribArray(vCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, G.rectPosBuffer);
    gl.vertexAttribPointer(vCoordLoc, 2, gl.FLOAT, false, 0, 0);
    uniforms.forEach(item => item.bind(gl.getUniformLocation(program, item.key)));

    return (output, input) => {
      output.bindFramebuffer();
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, glcl.nonceTexture);
      gl.uniform4f(outdimLoc, output.width, output.height, 1 / output.width, 1 / output.height);
      Object.keys(input).forEach(key => {
        const info = bindingInfo[key];
        const val = input[key];
        switch (info.type) {
          case 'vol':
            gl.uniform1i(info.loc, info.texIndex);
            gl.uniform4f(info.dimLoc, val.width, val.height, 1 / val.widthPOT, 1 / val.heightPOT);
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
    constructor(width = 1, height = 1, depth = 1) {
      if (depth < 1 || depth > 4) {
        throw new Error('depth must be between 1 and 4');
      }
      this.width = width;
      this.height = height;
      this.widthPOT = glcl.nearestPOT(width);
      this.heightPOT = glcl.nearestPOT(height);
      this.depth = depth;
      this.framebuffer = null;
      this.texture = gl.createTexture();
      this.buffer = new Float32Array(this.width * this.height * 4);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.widthPOT, this.heightPOT, 0, gl.RGBA, gl.FLOAT, null);
    }
    set(data) {
      let i = 0, j = 0;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          for (let z = 0; z < this.depth; z++) {
            this.buffer[i] = data[j];
            i++;
            j++;
          }
          i += 4 - this.depth;
        }
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.buffer);
    }
    get() {
      this.bindFramebuffer();
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.buffer, 0);
      const ret = new Float32Array(this.width * this.height * this.depth);
      let i = 0, j = 0;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          for (let z = 0; z < this.depth; z++) {
            ret[j] = this.buffer[i];
            i++;
            j++;
          }
          i += 4 - this.depth;
        }
      }
      return ret;
    }
    clear() {
      this.bindFramebuffer();
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    randomize(min = 0, max = 1) {
      const delta = max - min;
      for (let i = 0; i < this.buffer.length; i++) {
        this.buffer[i] = Math.random() * delta + min;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.buffer);
    }
    bindFramebuffer() {
      if (!this.framebuffer) {
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      }
      gl.viewport(0, 0, this.width, this.height);
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
