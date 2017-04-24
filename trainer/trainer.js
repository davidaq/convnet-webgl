const co = require('co');
const { Net, SGDTrainer } = require('convnetjs');
const Vol = require('./vol');

class Trainer {
  constructor(config) {
    this.config = config;
    if (config.loadedNetwork) {
      const net = new Net();
      net.fromJSON(config.loadedNetwork);
      this.layers = net.layers;
    } else {
      const net = new Net();
      net.makeLayers(config.layers);
      this.layers = net.layers;
    }
  }
  run() {
    co.wrap(function *() {
      try {
        const train = this.createTrainer();
        const inLayer = this.layers[0];
        const input = Vol(inLayer.out_sx, inLayer.out_sy, inLayer.out_depth);
        for (let i = 0; i < this.config.epochs; i++) {
          const epoch = {
            sampleCount: this.config.samples.length,
            softmax_loss: 0,
            cost_loss: 0,
            loss: 0,
            num: i + 1,
          };
          for (let j = 0; j < epoch.sampleCount; j++) {
            const sample = this.config.samples[j];
            sample.input(input);
            const trainResult = yield train(input.vol, sample.label);
            epoch.softmax_loss += trainResult.softmax_loss;
            epoch.cost_loss += trainResult.cost_loss;
            epoch.loss += trainResult.loss;
          }
          epoch.softmax_loss /= epoch.sampleCount;
          epoch.cost_loss /= epoch.sampleCount;
          epoch.loss /= epoch.sampleCount;
          this.handleEpoch(epoch);
        }
      } catch (err) {
        console.error(err.stack);
      }
    }).call(this);
  }
  createTrainer() {
    if (this.config.cpu) {
      const net = new Net();
      net.fromJSON({ layers: this.layers });
      const trainer = new SGDTrainer(net, {
        method: 'adadelta',
        batch_size: Math.min(50, Math.round(this.config.samples.length / 2)),
        l1_decay: 0.001,
        l2_decay: 0.001,
      });
      this.createEvaluator = this.createEvaluatorFactory((vol) => net.forward(vol).w);
      return (input, target) => Promise.resolve(trainer.train(input, target));
    } else {

    }
  }
  createEvaluatorFactory(fn) {
    return () => {
      const inLayer = this.layers[0];
      const buffer = Vol(inLayer.out_sx, inLayer.out_sy, inLayer.out_depth);
      return (input) => {
        input(buffer);
        return fn(buffer.vol);
      };
    };
  }
  handleEpoch(epoch) {
    epoch.createEvaluator = this.createEvaluator;
    this.config.epochListeners.forEach(fn => fn(epoch));
  }
}

module.exports = Trainer;
