const pipe = require('./pipe');
const Network = require('./network');
const gpu = require('./gpu');

let network;

pipe.register('init', async (props, layers) => {
  network = new Network(layers);
  console.log(network.forward({ w: [1, 1] }).get());
  await sleep(10000000);
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
