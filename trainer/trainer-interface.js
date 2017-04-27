const Path = require('path');
const Fs = require('fs');
const EventEmitter = require('events').EventEmitter;

class TrainerInterface extends EventEmitter {
  constructor(basedir, defaultSaveFile) {
    super();
    this.basedir = basedir;
    this.defaultSaveFile = defaultSaveFile;
    this.loadedNetwork = null;
    this.algorithm = { method: 'gpu' };
    this.layers = [];
    this.samples = [];
    this.maxEpoch = 1000;
    this.backend = null;
    this.stoped = false;
    this.saved = false;
  }
  useAlgorithm(algorithm) {
    this.algorithm = algorithm;
  }
  addLayer(conf) {
    this.layers.push(conf);
  }
  load(network) {
    this.loadedNetwork = network;
  }
  loadFile(fpath = this.defaultSaveFile) {
    try {
      const fcontent = Fs.readFileSync(Path.resolve(this.basedir, fpath));
      this.loadedNetwork = JSON.parse(fcontent);
      this.saved = true;
    } catch (err) {
      console.error('Warning: unable to read pre-trained network');
    }
  }
  saveFile(fpath = this.defaultSaveFile) {
    this.assertReady();
    this.saved = true;
    this.backend.getNetwork(net => {
      const payload = JSON.stringify(net.toJSON());
      Fs.writeFile(Path.resolve(this.basedir, fpath), payload, (err) => {
        if (err) {
          console.error(err.stack);
        }
      });
    });
  }
  setMaxEpoch(num) {
    this.maxEpoch = num;
  }
  addSample(sample) {
    this.samples.push(sample);
  }
  stop() {
    this.stoped = true;
  }
  evaluator(fn) {
    this.assertReady();
    this.backend.evaluator(fn);
  }
  assertReady() {
    if (!this.backend) {
      throw new Error('Trainer not ready');
    }
  }
}

module.exports = TrainerInterface;
