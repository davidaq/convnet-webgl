M(async () => {
  await sleep(2000);
  const pipe = await require('pipe');
  const train = await require('train');
  const glcl = await require('glcl');
  pipe.register('init', async (props, layers) => {
    glcl.init();
    const v1 = new glcl.Vol(130, 350, 3);
    const v2 = new glcl.Vol(130, 350, 3);
    const sum = glcl.createProgram({
      tex: 'vol',
    }, `
      mediump vec4 s = vec4(0, 0, 0, 0);
      for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
          s += tex(outpos + vec2(x, y));
        }
      }
      return s;
    `);
    v1.randomize(-10, 10);
    v2.clear();
    console.time('gpu');
    for (let i = 0; i < 1000; i++) {
      sum(v2, { tex: v1 });
    }
    console.timeEnd('gpu');
    console.log(v1.get());
    console.log(v2.get());
    v2.clear();
    console.log(v2.get());
    console.time('cpu');
    for (let i = 0; i < 1000; i++) {
      for (let j = 0; j < v2.buffer.length; j++) {
        v2.buffer[i] += v1.buffer[i];
      }
    }
    console.timeEnd('cpu');
    console.log(v1.buffer);
    console.log(v2.buffer);
    console.log('END');
    await sleep(30000000);
  });
  pipe.register('train', async (input, target) => {
    console.log(input, target);
    return {};
  });
  pipe.register('getNetwork', async () => {
  });
  pipe.register('close', async () => {
    setTimeout(() => {
      window.close();
    }, 1000);
  });
  pipe.ready();
});
