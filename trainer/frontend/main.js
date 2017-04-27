M(async () => {
  await sleep(2000);
  const pipe = await require('pipe');
  const train = await require('train');
  const glcl = await require('glcl');
  pipe.register('init', async (props, layers) => {
    glcl.init();
    const v1 = new glcl.Vol(3, 5, 1);
    const v2 = new glcl.Vol(3, 5, 1);
    const sum = glcl.createProgram({
      tex: 'vol',
    }, `
      mediump vec4 s = tex(outpos);
      return s;
    `);
    v1.set([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]);
    sum(v2, { tex: v1 });
    console.log(v2.get());
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
