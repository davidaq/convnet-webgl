const GPU = require('./gpu');
const InputLayer = require('./layers/input');
const FullConnLayer = require('./layers/fc');

function Network(initLayers) {
  const gpu = new GPU();
  
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
  console.log(layers);
}

module.exports = Network;
