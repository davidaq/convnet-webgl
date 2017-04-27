const configFile = process.argv[2];
if (!configFile) {
  console.error('Must provide a config file');
  process.exit(1);
}
const Path = require('path');
const TrainerInterface = require('./trainer-interface.js');
const TrainerController = require('./trainer-controller.js');

const resolvedConfigFile = require.resolve(Path.resolve(configFile));
const tInterface = new TrainerInterface(Path.dirname(resolvedConfigFile), resolvedConfigFile + 'on');
global.trainer = tInterface;
require(resolvedConfigFile);
const controller = new TrainerController(tInterface);
controller.run();
