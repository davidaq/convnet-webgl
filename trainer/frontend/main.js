Define(async () => {
  const pipe = await require('pipe');
  const train = await require('train');
  pipe.register('init', (input, target) => {
    console.log(input, target);
  });
  pipe.register('train', (input, target) => {
    console.log(input, target);
  });
  pipe.register('getNetwork', (input, target) => {
    console.log(input, target);
  });
  setTimeout(() => {
    pipe.ready();
  }, 2000);
});
