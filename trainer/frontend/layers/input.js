
function InputLayer(gpu, props) {
  const layer = {};
  layer.forward = (input) => {
    this.in = input;
    this.out = input;
    return input;
  };
  layer.backward = () => {
  };
  return layer;
}

module.exports = InputLayer;
