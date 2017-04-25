const configFile = process.argv[2];
if (!configFile) {
  console.error('Must provide a config file');
  process.exit(1);
}
const Path = require('path');
const TrainerConfig = require('./trainer-config.js');
const TrainerController = require('./trainer-controller.js');

const trainerConfig = new TrainerConfig(Path.dirname(configFile));
global.trainer = trainerConfig;
require(Path.resolve(configFile));
delete global.trainer;
const controller = new TrainerController(trainerConfig);
controller.run();
