const { Vol: ConvNetVol } = require('convnetjs');

ConvNetVol.prototype.toJSON = function () {
  const weights = [];
  for (let i = 0; i < this.w.length; i++) {
    weights.push(this.w[i].toFixed(4) - 0);
  }
  return {
    sx: this.sx,
    sy: this.sy,
    depth: this.depth,
    w: weights,
  };
};

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
