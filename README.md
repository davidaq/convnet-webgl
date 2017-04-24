# convnet-webgl
Train convolutional neural network using webgl.

***This is a working on project, and nothing is usable at this moment***

The aim of this work is to provide an easy to use cli tool to train ConvNetJS compatible
neural network with the boost power of GPU using webgl.

[ConvNetJS by karpathy](http://cs.stanford.edu/people/karpathy/convnetjs/) is a cool 
library for machine learning beginners as it's easy to install. But a pure JS trainer is
too slow to train out anything usefull.

Of cource, there's lots of open source industry ready frameworks out there. This one is
just a project for my own studing and provides as an learning option for those who does
not want to mess up with CUDA or MSVS. NodeJS and Chrome would be the only thing you
need to prepare.

## Install

```
npm install -g convnet-webgl
```

## Usage

Edit file my-network.js:

```
trainer.addLayer({ type: 'input', out_sx: 20, out_sy: 20, out_depth: 3 });
trainer.addLayer({ type: 'conv', sx: 3, filters: 4, stride: 1, pad: 1, activation: 'relu' });
trainer.addLayer({ type: 'pool', sx: 2, stride: 2 });
trainer.addLayer({ type: 'conv', sx: 3, filters: 16, stride: 1, pad: 1, activation: 'relu' });
trainer.addLayer({ type: 'pool', sx: 2, stride: 2 });
trainer.addLayer({ type:'softmax', num_classes: 26 });

trainer.setIterations(1000);

trainer.addSample({
  input: (vol) => {
    for (let x = 0; x < vol.width; x++) {
      for (let y = 0; y < vol.height; y++) {
        for (let z = 0; z < vol.depth; z++) {
          vol(x, y, z).set(0.5);
        }
      }
    }
  },
  label: 2,
});

```

Run in command line:

```
convnet-webgl my-network.js
```

This would produce my-network.json file which can then be used by ConvNetJS.
