const GPU = require('./gpu');
const InputLayer = require('./layers/input');
const FullConnLayer = require('./layers/fc');

function Network(initLayers) {
  const gpu = new GPU();

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

  const inputBuffer = new gpu.Buffer2D(initLayers[0].out_sx, initLayers[0].out_sy);
  network.forward = (input) => {
    inputBuffer.set(input.w);
    return layers.reduce((prevOut, layer) => layer.forward(prevOut), inputBuffer);
  };

  network.backward = (error) => {
    return revLayers.reduce((prevErr, layer) => layer.backward(prevErr), error);
  };

  return network;
}

module.exports = Network;
