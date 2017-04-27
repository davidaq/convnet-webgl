
function GPU() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl');
  const gpu = {};

  const rectPosBuffer = gl.createBuffer();
  const nonceTexture = gl.createTexture();
  const passthruVertexShader = gl.createShader(gl.VERTEX_SHADER);

  function init() {
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
    gl.bindBuffer(gl.ARRAY_BUFFER, rectPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, nonceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.FLOAT, null);

    gpu.createShader(passthruVertexShader, `
      attribute mediump vec2 v_coord;
      varying highp vec2 f_outpos;
      void main() {
        f_outpos = v_coord;
        gl_Position = vec4(v_coord.xy * 2.0 - 1.0, 0.0, 1.0);
      }
    `);
  }

  gpu.sync = () => {
    gl.finish();
  };

  gpu.createShader = (type, code) => {
    const shader = typeof type === 'string' ? gl.createShader(type) : type;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info + '\n'
        + code.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
    }
    return shader;
  };

  gpu.createProgram = (binding, code) => {
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
        code = code.replace(new RegExp(`width\\s*\\(\\s*${key}\\s*\\)`, 'g'), `voldim_${key}.x`);
        code = code.replace(new RegExp(`height\\s*\\(\\s*${key}\\s*\\)`, 'g'), `voldim_${key}.y`);
      } else {
        uniforms.push({ key, bind: loc => info.loc = loc });
        info.decl = `uniform ${bindingDecl} ${key};`;
      }
    });

    const program = gl.createProgram();
    const fragmentShader = gpu.createShader(gl.FRAGMENT_SHADER, `
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
    gl.attachShader(program, passthruVertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vCoordLoc = gl.getAttribLocation(program, 'v_coord');
    const outdimLoc = gl.getUniformLocation(program, 'f_outdim');
    gl.enableVertexAttribArray(vCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, rectPosBuffer);
    gl.vertexAttribPointer(vCoordLoc, 2, gl.FLOAT, false, 0, 0);
    uniforms.forEach(item => item.bind(gl.getUniformLocation(program, item.key)));

    const ret = {};
    ret.run = (output, input) => {
      output.bindFramebuffer();
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, nonceTexture);
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
    return ret;
  };

  class Vol {
    constructor(width = 1, height = 1, depth = 1) {
      if (depth < 1 || depth > 4) {
        throw new Error('depth must be between 1 and 4');
      }
      this.width = width;
      this.height = height;
      this.widthPOT = nearestPOT(width);
      this.heightPOT = nearestPOT(height);
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
  }

  gpu.Vol = Vol;

  gpu.destroy = () => {
    canvas.parentElement.removeChild(canvas);
  };

  function nearestPOT(num) {
    let ret = 1;
    while (ret < num) {
      ret *= 2;
    }
    return ret;
  }

  init();
  return gpu;
}

module.exports = GPU;
