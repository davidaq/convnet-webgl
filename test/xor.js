trainer.addLayer({ type: 'input', out_sx: 2, out_sy: 1, out_depth: 1 });
trainer.addLayer({ type: 'fc', num_neurons: 10, activation: 'relu' });
trainer.addLayer({ type: 'fc', num_neurons: 10, activation: 'relu' });
trainer.addLayer({ type: 'regression', num_neurons: 1 });

trainer.setEpochs(1000);
trainer.useCPU();

trainer.onEpoch(epoch => {
  if (epoch.num === 1000) {
    console.log(epoch.loss);
    const evaluate = epoch.createEvaluator();
    console.log(Math.round(
      evaluate(vol => {
        vol(0).set(0);
        vol(1).set(0);
      })[0]
    ));
    console.log(Math.round(
      evaluate(vol => {
        vol(0).set(1);
        vol(1).set(1);
      })[0]
    ));
    console.log(Math.round(
      evaluate(vol => {
        vol(0).set(1);
        vol(1).set(0);
      })[0]
    ));
    console.log(Math.round(
      evaluate(vol => {
        vol(0).set(0);
        vol(1).set(1);
      })[0]
    ));
  }
});

trainer.addSample({
  input: (vol) => {
    vol(0).set(0);
    vol(1).set(0);
  },
  label: [0],
});
trainer.addSample({
  input: (vol) => {
    vol(0).set(1);
    vol(1).set(0);
  },
  label: [1],
});
trainer.addSample({
  input: (vol) => {
    vol(0).set(0);
    vol(1).set(1);
  },
  label: [1],
});
trainer.addSample({
  input: (vol) => {
    vol(0).set(1);
    vol(1).set(1);
  },
  label: [0],
});
