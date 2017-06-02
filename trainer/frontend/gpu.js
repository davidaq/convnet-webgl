/**
 * General purpose gpu calculation powered by webgl
 */

/**
 * The ultimate function to create a gpgpu context
 */
function GPU() {
  /**
   * Returned interface instance for further user usage
   */
  const gpu = {};

  /**
   * Constants used all over this gpgpu context
   */
  const bufferPacks = {};
  let gl, rectPosBuffer, nonceTexture, passthruVertexShader;
  init();
  const copyProgram = createProgram({ source: 'buffer' }, `
    return source(outpos);
  `);

  /**
   * Initialize canvas, webgl and some overall constants
   */
  function init() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    document.body.appendChild(canvas);
    gl = canvas.getContext('webgl');
    gl.getExtension('OES_texture_float');
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.disable(gl.DEPTH_TEST);

    rectPosBuffer = gl.createBuffer();
    nonceTexture = gl.createTexture();

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

    passthruVertexShader = createShader(gl.VERTEX_SHADER, `
      attribute mediump vec2 v_coord;
      varying highp vec2 f_outpos;
      void main() {
        f_outpos = v_coord;
        gl_Position = vec4(v_coord.xy * 2.0 - 1.0, 0.0, 1.0);
      }
    `);
  }

  /**
   * Generate a compiled vertex or fragment shader
   * @param {*} type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
   * @param {string} code shader glsl code
   */
  function createShader(type, code) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info + '\n'
        + code.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
    }
    return shader;
  };

  /**
   * Find the least power of two bigger than a target
   * @param {*} num minimum returned number
   */
  function leastPOT(num) {
    let ret = 1;
    while (ret < num) {
      ret *= 2;
    }
    return ret | 0;
  }

  /**
   * Allocate a packed texture buffer
   * @param {*} width used buffer width
   * @param {*} height used buffer height
   * @param {*} flag  whether the texture is dedicated for receiving program output
   */
  function allocBuffer(width, height, flag) {
    const widthPOT = leastPOT(width);
    const heightPOT = leastPOT(height);
    const index = widthPOT * 16384 + heightPOT * 2 + flag;
    let list = bufferPacks[index];
    if (!list) {
      list = [];
      bufferPacks[index] = list;
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
      list.push(packed);
    }
    packed.slots[slot] = { width, height };
    packed.freeSlots--;
    return [packed, slot];
  };

  /**
   * Create a gpgpu program
   * @param {*} binding define bound uniforms
   * @param {*} code the fragment shader code, should return a float
   */
  function createProgram(binding, code) {
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
      } else {
        uniforms.push({ key, bind: loc => info.loc = loc });
        info.decl = `uniform ${bindingDecl} ${key};`;
      }
    });

    const program = gl.createProgram();
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, `
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

    const ret = (output, input = {}, fromSolve = false) => {
      if (!fromSolve) {
        return output.solve(ret, input);
      }
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
              val.packed.bindTexture(info.texIndexEnum);
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
  gpu.createProgram = createProgram;

  /**
   * Block until gpu operations are finished
   */
  gpu.sync = () => {
    gl.finish();
  };

  /**
   * Internal use class, provides 4 buffer slots each taking a rgba channel
   */
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
      if (this.needDownload) {
        if (this.needUpload) {
          console.warn('Downloading texture data when upload is also needed');
        }
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
    bindTexture(texIndexEnum) {
      gl.activeTexture(texIndexEnum || gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      this.upload();
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
  
  /**
   * User interface buffer, holds 2 dimentional float point data which
   * can be used as program input or output
   */
  class Buffer2D {
    constructor(width, height = 1, isSwap = false) {
      width = width | 0;
      height = height | 0;
      this.width = width;
      this.height = height;
      this.widthPOT = leastPOT(width);
      this.heightPOT = leastPOT(height);
      this.recycled = false;
      this.buffer = new Float32Array(width * height);
      [this.packed, this.slot] = allocBuffer(this.width, this.height, isSwap ? 1 : 0);
      this.isSwap = isSwap;
      this.swap = null;
    }
    solve(program, bindings) {
      this.packed.bindTexture();
      const bindingKeys = Object.keys(bindings);
      let needSwap = false;
      if (!this.isSwap) {
        for (let i = 0; i < bindingKeys.length; i++) {
          const bindingItem = bindings[bindingKeys[i]];
          if (bindingItem instanceof Buffer2D && bindingItem.packed === this.packed) {
            needSwap = true;
            break;
          }
        }
      }
      if (needSwap) {
        if (!this.swap) {
          this.swap = new Buffer2D(this.width, this.height, true);
        }
        this.swap.solve(program, bindings);
        this.bindFramebuffer();
        copyProgram(this, { source: this.swap }, true);
      } else {
        this.bindFramebuffer();
        program(this, bindings, true);
      }
      this.packed.needDownload = true;
    }
    bindFramebuffer() {
      const { packed, slot, width, height } = this;
      packed.bindFramebuffer();
      gl.viewport(0, 0, width, height);
      gl.colorMask(slot === 0, slot === 1, slot === 2, slot === 3);
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
      this.packed.needDownload = true;
    }
    recycle() {
      this.isRecycled = true;
      this.packed.recycle(this.slot);
      if (this.swap) {
        this.swap.recycle();
      }
    }
  }

  gpu.Buffer2D = Buffer2D;

  /**
   * destroy the current gpgpu context
   */
  gpu.destroy = () => {
    canvas.parentElement.removeChild(canvas);
  };

  return gpu;
}

module.exports = GPU;
