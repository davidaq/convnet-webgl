
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
    gl.getExtension('OES_texture_float');
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
      if (info.type === 'buffer') {
        textureCounter++;
        info.texIndex = textureCounter;
        info.texIndexEnum = gl[`TEXTURE${textureCounter}`];
        uniforms.push({ key: `voltex_${key}`, bind: loc => info.loc = loc });
        uniforms.push({ key: `voldim_${key}`, bind: loc => info.dimLoc = loc });
        uniforms.push({ key: `volmask_${key}`, bind: loc => info.maskLoc = loc });
        info.decl = `
          uniform mediump vec4 voldim_${key};
          uniform lowp vec4 volmask_${key};
          uniform sampler2D voltex_${key};
          float ${key} (vec2 pxpos) {
            return dot(volmask_${key}, texture2D(voltex_${key}, voldim_${key}.zw * (pxpos + 0.5)));
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
      uniform int f_outchannel;
      uniform mediump vec4 f_outdim;

      ${Object.keys(binding).map(key => bindingInfo[key].decl).join('')}
      float run(vec2 outpos) {
        ${code}
      }
      void main() {
        vec2 outpos = f_outpos * f_outdim.xy - 0.5;
        float result = run(outpos);
        gl_FragColor = vec4(run(outpos));
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
      output.packed.needUpload = false;
      output.packed.needDownload = true;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, nonceTexture);
      gl.uniform4f(outdimLoc, output.width, output.height, 1 / output.width, 1 / output.height);
      Object.keys(input).forEach(key => {
        const info = bindingInfo[key];
        if (info) {
          const val = input[key];
          switch (info.type) {
            case 'buffer':
              gl.uniform1i(info.loc, info.texIndex);
              gl.uniform4f(info.dimLoc, val.width, val.height, 1 / val.widthPOT, 1 / val.heightPOT);
              gl.uniform4f(info.maskLoc, val.slot === 0 ? 1 : 0, val.slot === 1 ? 1 : 0, val.slot === 2 ? 1 : 0, val.slot === 3 ? 1 : 0);
              gl.activeTexture(info.texIndexEnum);
              gl.bindTexture(gl.TEXTURE_2D, val.texture);
              val.packed.upload();
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

  class Buffer2DPacked {
    constructor(width = 1, height = 1) {
      this.slots = [false, false, false, false];
      this.freeSlots = 4;
      this.needDownload = false;
      this.needUpload = false;
      this.width = width;
      this.height = height;
      this.framebuffer = null;
      this.texture = gl.createTexture();
      this.buffer = new Float32Array(this.width * this.height * 4);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);
    }
    randomize(min = 0, max = 1, slot) {
      const { width: w, height: h } = this.slots[slot];
      const delta = max - min;
      this.download();
      for (let y = 0; y < h; y++) {
        const tline = y * this.width;
        for (let x = 0; x < w; x++) {
          this.buffer[(tline + x) * 4 + slot] = Math.random() * delta + min;
        }
      }
      this.needUpload = true;
    }
    set(data, slot) {
      const { width: w, height: h } = this.slots[slot];
      this.download();
      for (let y = 0; y < h; y++) {
        const tline = y * this.width;
        const sline = y * w;
        for (let x = 0; x < w; x++) {
          this.buffer[(tline + x) * 4 + slot] = data[sline + x];
        }
      }
      this.needUpload = true;
    }
    get(slot) {
      const { width: w, height: h } = this.slots[slot];
      this.download();
      const ret = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const tline = y * this.width;
        const sline = y * w;
        for (let x = 0; x < w; x++) {
          ret[sline + x] = this.buffer[(tline + x) * 4 + slot];
        }
      }
      return ret;
    }
    download() {
      if (!this.needUpload && this.needDownload) {
        this.bindFramebuffer();
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.buffer, 0);
        this.needDownload = false;
      }
    }
    upload() {
      if (this.needUpload) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.buffer);
        this.needUpload = false;
      }
    }
    bindFramebuffer() {
      if (!this.framebuffer) {
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      }
    }
    recycle(slot) {
      if (this.slots[slot]) {
        this.slots[slot] = false;
        this.freeSlots++; 
      }
    }
  }
  const buffers = {};
  Buffer2DPacked.alloc = (width, height, widthPOT, heightPOT) => {
    const index = widthPOT * 8192 + heightPOT;
    let list = buffers[index];
    if (!list) {
      list = [];
      buffers[index] = list;
    }
    let packed = null;
    let slot = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].freeSlots > 0) {
        packed = list[i];
        for (let j = 0; j < 4; j++) {
          if (!packed.slots[j]) {
            slot = j;
            break;
          }
        }
        break;
      }
    }
    if (!packed) {
      packed = new Buffer2DPacked(widthPOT, heightPOT);
    }
    packed.slots[slot] = { width, height };
    packed.freeSlots--;
    return [packed, slot];
  };
  
  class Buffer2D {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.widthPOT = nearestPOT(width);
      this.heightPOT = nearestPOT(height);
      this.recycled = false;
      this.buffer = new Float32Array(width * height);
      [this.packed, this.slot] = Buffer2DPacked.alloc(this.width, this.height, this.widthPOT, this.heightPOT);
      this.texture = this.packed.texture;
    }
    solve(program, bindings) {
      program(this, bindings);
    }
    bindFramebuffer() {
      this.packed.bindFramebuffer();
      gl.viewport(0, 0, this.width, this.height);
      gl.colorMask(this.slot === 0, this.slot === 1, this.slot === 2, this.slot === 3);
    }
    set(data) {
      this.packed.set(data, this.slot);
    }
    get() {
      return this.packed.get(this.slot);
    }
    randomize(min = 0, max = 1) {
      this.packed.randomize(min, max, this.slot);
    }
    clear() {
      this.bindFramebuffer();
      gl.clear(gl.COLOR_BUFFER_BIT);
      // TODO: set packed buffer
    }
    recycle() {
      this.recycled = true;
      this.packed.recycle(this.slot);
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

window.pack = function pack(f, vec = [], p = 0) {
  vec[0] = Math.floor(f);
  return vec;
  // const fract = (v) => v - Math.floor(v);
  // const bit_shift = [256 * 256 * 256 , 256 * 256, 256, 1];
  // const bit_mask = [0, 1 / 256, 1 / 256, 1 / 256];
  // const res = bit_shift.map(v => fract(v * f));
  // res[0] -= res[0] * bit_mask[0];
  // res[1] -= res[0] * bit_mask[1];
  // res[2] -= res[1] * bit_mask[2];
  // res[3] -= res[2] * bit_mask[3];
  // return res.map(v => Math.floor(v * 255));
  // vec4 pack_float(float f) {
  //   const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
  //   const vec4 bit_mask = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
  //   vec4 res = fract(f * bit_shift);
  //   res -= res.xxyz * bit_mask;
  //   return res;
  // }
}

window.unpack = function unpack(vec, p = 0) {
  const bit_shift = [1 / (256 * 256 * 256), 1 / (256 * 256), 1 / (256), 1];
  const res = bit_shift.map((v, i) => v * vec[i + p] / 255).reduce((a, b) => a + b);
  return res;
}

//       float unpack_float(vec4 rgba) {
//         const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
//         float res = dot(rgba, bit_shift);
//         return res;
//       }
