const co = require('co');
const { Net } = require('convnetjs');
const Vol = require('./vol');
const GPUTrainer = require('./gpu-trainer');
const ConvNetJSTrainer = require('./convnetjs-trainer');

class Trainer {
  constructor(config) {
    this.createEvaluator = this.createEvaluator.bind(this);

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

    const TrainerClass = this.config.algorithm.method === 'gpu' ? GPUTrainer : ConvNetJSTrainer;
    this.trainer = new TrainerClass(this.config.algorithm, this.layers);
  }
  run() {
    co.wrap(function *() {
      try {
        yield this.trainer.ready();
        const inLayer = this.layers[0];
        const input = Vol(inLayer.out_sx, inLayer.out_sy, inLayer.out_depth);
        for (let i = 0; ; i++) {
          const epoch = {
            sampleCount: this.config.samples.length,
            softmax_loss: 0,
            cost_loss: 0,
            loss: 0,
            epoch: i + 1,
          };
          for (let j = 0; j < epoch.sampleCount; j++) {
            const sample = this.config.samples[j];
            sample.input(input);
            const trainResult = yield this.trainer.train(input.vol, sample.label);
            epoch.softmax_loss += trainResult.softmax_loss;
            epoch.cost_loss += trainResult.cost_loss;
            epoch.loss += trainResult.loss;
          }
          epoch.softmax_loss /= epoch.sampleCount;
          epoch.cost_loss /= epoch.sampleCount;
          epoch.loss /= epoch.sampleCount;
          if (this.handleEpoch(epoch) === false) {
            break;
          }
        }
      } catch (err) {
        console.error(err.stack);
      }
    }).call(this);
  }
  createEvaluator(cb) {
    co.wrap(function *() {
      try {
        const net = yield this.trainer.getNetwork();
        const inLayer = this.layers[0];
        const buffer = Vol(inLayer.out_sx, inLayer.out_sy, inLayer.out_depth);
        cb((input) => {
          input(buffer);
          return net.forward(buffer.vol).w;
        });
      } catch (err) {
        console.error(err.stack);
      }
    }).call(this);
  }
  handleEpoch(epoch) {
    epoch.createEvaluator = this.createEvaluator;
    return this.config.epochListener(epoch);
  }
}

module.exports = Trainer;
