
function ReluLayer(gpu, props) {
  const layer = {};
  const output = new gpu.Buffer2D(props.out_depth);

  const program = gpu.createProgram(
    {
      i: 'buffer',
    },
    `
      return max(0.0, i(outpos));
    `
  );
  
  layer.forward = (input) => {
    this.in = input;
    this.output = output;
    output.solve(program, { i: input });
    return output;
  };

  layer.backward = () => {
  };

  return layer;
}

module.exports = ReluLayer;
