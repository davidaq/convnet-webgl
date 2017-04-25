Define(async () => {
  const pipe = await require('pipe');
  const train = await require('train');
  const glcl = await require('glcl');
  pipe.register('init', async (props, layers) => {
    glcl.init();
    glcl.createVol(100, 100, 2);
    await new Promise(r => null);
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
  setTimeout(() => {
    pipe.ready();
  }, 2000);
});
