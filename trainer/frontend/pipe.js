const rpc = {};
const pipe = {
  register(funcName, func) {
    rpc[funcName] = func;
  },
  sendEvent(eventName, data) {
    fetch('/cse', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ eventName, data }),
    });
  },
  ready() {
    this.sendEvent('rpc-return', { id: 0, value: true });
  },
  sse: new EventSource('/event-stream'),
};
pipe.sse.addEventListener('rpc', async (event) => {
  const { id, func, args } = JSON.parse(event.data);
  pipe.sendEvent('rpc-return', { id, value: await rpc[func](...args) });
});
let lastBeat = Date.now();
pipe.sse.addEventListener('heart-beat', () => {
  lastBeat = Date.now();
});
setInterval(() => {
  if (Date.now() - lastBeat > 3000) {
    console.log('Disconnected');
    window.close();
  }
}, 3000);
module.exports = pipe;
