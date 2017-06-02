
function FullConnLayer(gpu, props) {
  const layer = {};
  const weight = new gpu.Buffer2D(props.num_inputs, props.out_depth);
  const bias = new gpu.Buffer2D(props.out_depth);
  
  bias.set(props.biases.w);

  const weightArr = [];
  props.filters.forEach(neuron => {
    neuron.w.forEach(w => {
      weightArr.push(w);
    })
  });
  weight.set(weightArr);

  const output = new gpu.Buffer2D(props.out_depth);
  let weightStatement = '';
  for (let i = 0; i < props.num_inputs; i++) {
    weightStatement += ` + w(vec2(${i}.0, outpos.x)) * i(vec2(${i}.0, 0))`;
  }
  const program = gpu.createProgram(
    {
      i: 'buffer',
      w: 'buffer',
      b: 'buffer',
    },
    `
      return b(outpos)${weightStatement};
    `
  );
  
  layer.forward = (input) => {
    this.in = input;
    this.out = output;
    output.solve(program, { i: input, w: weight, b: bias });
    return output;
  };
  layer.backward = () => {
  };
  return layer;
}

module.exports = FullConnLayer;
