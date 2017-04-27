
function FullConnLayer(gpu, props) {
  const layer = {};
  gpu.createProgram()
  layer.forward = (input) => {
    this.in = input;
    this.out = input;
    return input;
  };
  layer.backward = () => {
  };
  return layer;
}

module.exports = FullConnLayer;
