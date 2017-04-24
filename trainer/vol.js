const { Vol: ConvNetVol } = require('convnetjs');

function Vol(width, height, depth) {
  const cvol = new ConvNetVol(width, height, depth);
  const vol = (x = 0, y = 0, z = 0) => ({
    set: v => {
      cvol.set(x, y, z, v);
    },
  });
  vol.width = width;
  vol.height = height;
  vol.depth = depth;
  vol.vol = cvol;
  return vol;
}

module.exports = Vol;
