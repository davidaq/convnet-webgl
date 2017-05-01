const GPU = require('./gpu');
const InputLayer = require('./layers/input');
const FullConnLayer = require('./layers/fc');

function Network(initLayers) {
  const gpu = new GPU();

  const vol = new gpu.Buffer2D(3, 3);
  const vol2 = new gpu.Buffer2D(3, 3);
  vol2.set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  vol.randomize();
  const program = gpu.createProgram({
    inp1: 'buffer',
    inp2: 'buffer',
  }, `
    return inp1(outpos) + inp2(outpos);
  `);
  vol.solve(program, { inp1: vol, inp2: vol2 });
  console.log(vol.get(), vol2.get());


  const network = {};
  
  const layerTypeMap = {
    input: InputLayer,
    fc: FullConnLayer,
  };
  const layers = initLayers.map(layer => {
    const MixedLayer = layerTypeMap[layer.layer_type];
    if (MixedLayer) {
      return new MixedLayer(gpu, layer);
    }
  }).filter(v => !!v);
  const revLayers = layers.slice(0).reverse(); 

  network.forward = (input) => {
    return layers.reduce((prevOut, layer) => layer.forward(prevOut), input);
  };

  network.backward = (error) => {
    return revLayers.reduce((prevErr, layer) => layer.backward(prevErr), error);
  };

  return network;
}

module.exports = Network;
