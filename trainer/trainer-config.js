const Path = require('path');
const Fs = require('fs');

class TrainerConfig {
  constructor(basedir) {
    this.basedir = basedir;
    this.loadedNetwork = null;
    this.algorithm = { 'gpu' };
    this.layers = [];
    this.samples = [];
    this.epochListener = (currentState) => currentState.num < 1000;
  }
  useAlgorithm(algorithm) {
    this.algorithm = algorithm;
  }
  onEpoch(fn) {
    this.epochListener = fn;
  }
  addLayer(conf) {
    this.layers.push(conf);
  }
  load(network) {
    this.loadedNetwork = network;
  }
  loadFile(fpath) {
    const fcontent = FS.readFileSync(Path.resolve(this.basedir, fpath));
    this.loadedNetwork = JSON.parse(fcontent);
  }
  setEpochs(num) {
    this.epochs = num;
  }
  addSample(sample) {
    this.samples.push(sample);
  }
}

module.exports = TrainerConfig;
