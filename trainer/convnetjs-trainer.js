const { Net, SGDTrainer } = require('convnetjs');

class ConvNetJSTrainer {
  constructor(props, layers) {
    this.net = new Net();
    this.net.fromJSON({ layers: layers });
    this.trainer = new SGDTrainer(this.net, props);
  }

  ready() {
    return Promise.resolve(true);
  }

  train(input, target) {
    return Promise.resolve(this.trainer.train(input, target));
  }

  getNetwork() {
    return Promise.resolve(this.net);
  }
}

module.exports = ConvNetJSTrainer;
