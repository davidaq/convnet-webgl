await sleep(2000);
const pipe = require('./pipe');
const train = require('./train');
const gpu = require('./gpu');
pipe.register('init', async (props, layers) => {
  gpu.init();
  console.time('gpu');
  const v1 = new gpu.Vol(130, 350, 3);
  const v2 = new gpu.Vol(130, 350, 3);
  const sum = gpu.createProgram({
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
  for (let i = 0; i < 1000; i++) {
    sum(v2, { tex: v1 });
  }
  gpu.sync();
  console.log(v1.get());
  console.log(v2.get());
  console.timeEnd('gpu');
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
