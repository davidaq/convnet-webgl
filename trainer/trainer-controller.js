const co = require('co');
const { Net } = require('convnetjs');
const Vol = require('./vol');
const GPUTrainer = require('./gpu-trainer');
const ConvNetJSTrainer = require('./convnetjs-trainer');

class Trainer {
  constructor(tInterface) {
    this.tInterface = tInterface;
    this.initNetwork = new Net();
    if (tInterface.loadedNetwork) {
      this.initNetwork.fromJSON(tInterface.loadedNetwork);
    } else {
      this.initNetwork.makeLayers(tInterface.layers);
    }
    this.layers = this.initNetwork.layers;
  }
  run() {
    return co.wrap(function *() {
      try {
        this.tInterface.backend = this;
        this.tInterface.emit('ready');
        const inLayer = this.layers[0];
        const input = new Vol(inLayer.out_sx, inLayer.out_sy, inLayer.out_depth);
        const status = {
          sampleCount: this.tInterface.samples.length,
          softmax_loss: 0,
          cost_loss: 0,
          loss: 0,
          epoch: 0,
        };
        for (let i = 0; i < this.tInterface.maxEpoch && !this.tInterface.stoped; i++) {
          status.sampleCount = this.tInterface.samples.length;
          status.softmax_loss = 0;
          status.cost_loss = 0;
          status.loss = 0;
          status.epoch = i + 1;
          for (let j = 0; j < status.sampleCount; j++) {
            if (!this.trainer) {
              const TrainerClass = this.tInterface.algorithm.method === 'gpu' ? GPUTrainer : ConvNetJSTrainer;
              this.trainer = new TrainerClass(this.tInterface.algorithm, this.layers);
              yield this.trainer.ready();
            }
            const sample = this.tInterface.samples[j];
            sample.input(input);
            const trainResult = yield this.trainer.train(input.vol, sample.label);
            status.softmax_loss += trainResult.softmax_loss;
            status.cost_loss += trainResult.cost_loss;
            status.loss += trainResult.loss;
            this.tInterface.saved = false;
          }
          status.softmax_loss /= status.sampleCount;
          status.cost_loss /= status.sampleCount;
          status.loss /= status.sampleCount;
          this.tInterface.emit('epoch', status);
        }
        this.tInterface.emit('finish', status);
        if (!this.tInterface.saved) {
          this.tInterface.saveFile();
        }
      } catch (err) {
        if (this.tInterface.listeners('error').length > 0) {
          this.tInterface.emit('error', err);
        } else {
          console.error(err.stack);
        }
      } finally {
        if (this.trainer) {
          yield this.trainer.close();
        }
        this.tInterface.emit('close');
      }
    }).call(this);
  }
  getNetwork(cb) {
    return co.wrap(function *() {
      try {
        if (!this.trainer) {
          cb(this.initNetwork);
        } else {
          cb(yield this.trainer.getNetwork());
        }
      } catch (err) {
        console.error(err.stack);
      }
    }).call(this);
  }
  evaluator(cb) {
    this.getNetwork(net => {
      const inLayer = this.layers[0];
      const buffer = new Vol(inLayer.out_sx, inLayer.out_sy, inLayer.out_depth);
      cb((input) => {
        input(buffer);
        return net.forward(buffer.vol).w;
      });
    });
  }
}

module.exports = Trainer;
