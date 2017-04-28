
function FullConnLayer(gpu, props) {
  const layer = {};

  const weights = new gpu.Buffer2D(3, 3);
  weights.set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const pass = gpu.createProgram(
    {
      wv: 'vol',
    },
    `return 1.2;`
  );

  const v = new gpu.Buffer2D(3, 3);
  weights.copyTo(v);
  pass(v, { wv: weights });
  console.log(v.get());

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
