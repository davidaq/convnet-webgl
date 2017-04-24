const Path = require('path');
const Fs = require('fs');

class TrainerConfig {
  constructor(basedir) {
    this.basedir = basedir;
    this.loadedNetwork = null;
    this.cpu = false;
    this.layers = [];
    this.samples = [];
    this.epochs = 100;
    this.epochListeners = [];
  }
  useCPU() {
    this.cpu = true;
  }
  onEpoch(fn) {
    this.epochListeners.push(fn);
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
