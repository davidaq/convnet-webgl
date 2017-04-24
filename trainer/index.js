const configFile = process.argv[2];
if (!configFile) {
  console.error('Must provide a config file');
  process.exit(1);
}
const Path = require('path');
const TrainerConfig = require('./trainer-config.js');
const Trainer = require('./trainer.js');

const trainerConfig = new TrainerConfig(Path.dirname(configFile));
global.trainer = trainerConfig;
require(Path.resolve(configFile));
delete global.trainer;
const trainer = new Trainer(trainerConfig);
trainer.run();
