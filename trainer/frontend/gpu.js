
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

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
    const shader = type instanceof WebGLShader ? type : gl.createShader(type);
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
          float ${key} (vec2 pxpos) {
            return unpack_float(texture2D(voltex_${key}, voldim_${key}.zw * (pxpos + 0.5)));
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

      vec4 pack_float(float f) {
        const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
        const vec4 bit_mask = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
        vec4 res = fract(f * bit_shift);
        res -= res.xxyz * bit_mask;
        return res;
      }
      float unpack_float(vec4 rgba) {
        const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
        float res = dot(rgba, bit_shift);
        return res;
      }

      varying highp vec2 f_outpos;
      uniform mediump vec4 f_outdim;

      ${Object.keys(binding).map(key => bindingInfo[key].decl).join('')}
      float run(vec2 outpos) {
        ${code}
      }
      void main() {
        vec2 outpos = f_outpos * f_outdim.xy - 0.5;
        gl_FragColor = pack_float(run(outpos));
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

    const ret = (output, input) => {
      output.bindFramebuffer();
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, nonceTexture);
      gl.uniform4f(outdimLoc, output.width, output.height, 1 / output.width, 1 / output.height);
      Object.keys(input).forEach(key => {
        const info = bindingInfo[key];
        if (info) {
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
        }
      });
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    };
    ret.destroy = () => {
    };
    return ret;
  };

  class Buffer2D {
    constructor(width = 1, height = 1) {
      this.width = width;
      this.height = height;
      this.widthPOT = nearestPOT(width);
      this.heightPOT = nearestPOT(height);
      this.framebuffer = null;
      this.texture = gl.createTexture();
      this.bytesLength = this.width * this.height * 4;
      this.buffer = new ArrayBuffer(this.bytesLength);
      this.bufferByteView = new Uint8Array(this.buffer);
      this.bufferFloatView = new Float32Array(this.buffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.widthPOT, this.heightPOT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    set(data) {
      for (let i = this.bytesLength; i >= 0; i--) {
        this.bufferFloatView[i] = data[i];
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.bufferByteView);
    }
    get() {
      this.bindFramebuffer();
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.bufferByteView, 0);
      return this.bufferFloatView.slice(0);
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
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.buffer);
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
    copyTo(target) {
      this.bindFramebuffer();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, target.width, target.height, 0);
    }
  }

  gpu.Buffer2D = Buffer2D;

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

window.pack = function pack(f) {
  const fract = (v) => v - Math.floor(v);
  const bit_shift = [256 * 256 * 256 , 256 * 256, 256, 1];
  const bit_mask = [0, 1 / 256, 1 / 256, 1 / 256];
  const res = bit_shift.map(v => fract(v * f));
  res[0] -= res[0] * bit_mask[0];
  res[1] -= res[0] * bit_mask[1];
  res[2] -= res[1] * bit_mask[2];
  res[3] -= res[2] * bit_mask[3];
  return res;
  // vec4 pack_float(float f) {
  //   const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
  //   const vec4 bit_mask = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
  //   vec4 res = fract(f * bit_shift);
  //   res -= res.xxyz * bit_mask;
  //   return res;
  // }
}

      float unpack_float(vec4 rgba) {
        const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
        float res = dot(rgba, bit_shift);
        return res;
      }