const Http = require('http');
const Fs = require('fs');
const Path = require('path');
const os = require('os');
const opn = require('opn');
const concat = require('concat-stream');
const { Net } = require('convnetjs');

class GPUTrainer {
  constructor(props, layers) {
    this.props = props;
    this.layers = layers;
    this.browser = null;
    this.rpcCounter = 1;
    this.rpcResolves = {};
    this.server = Http.createServer((req, res) => {
      switch (req.url) {
        case '/':
          if (this.browser) {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            Fs.createReadStream(Path.join(__dirname, 'frontend', 'html', 'no-second.html')).pipe(res);
          } else {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            Fs.createReadStream(Path.join(__dirname, 'frontend', 'html', 'main.html')).pipe(res);
          }
          break;
        case '/event-stream':
          if (!this.browser) {
            res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
            this.browser = res;
            this.browserHeartBeat = setInterval(() => {
              this.sendEvent('heart-beat');
            }, 1000);
          }
          break;
        case '/cse':
          req.pipe(concat(buffer => {
            res.end('{}');
            const { eventName, data } = JSON.parse(buffer);
            this.receiveEvent(eventName, data);
          }));
          break;
        default:
          const fpath = Path.join(__dirname, 'frontend', req.url.substr(1));
          Fs.exists(fpath, exists => {
            exists ? Fs.createReadStream(fpath).pipe(res) : res.end();
          });
          break;
      }
    });
    this.server.listen(() => {
      const app = ({ win32: 'chrome', linux: 'google-chrome' })[os.platform()] || 'google chrome';
      opn(`http://localhost:${this.server.address().port}/`, { app });
    });
  }

  sendEvent(eventName, data) {
    if (this.browser.socket.destroyed) {
      console.log('Browser closed');
      process.exit(1);
    }
    this.browser.write(`event: ${eventName}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`);
  }

  receiveEvent(eventName, data) {
    switch (eventName) {
      case 'rpc-return':
        this.rpcResolves[data.id](data.value);
        delete this.rpcResolves[data.id];
        break;
    }
  }

  rpc(func, ...args) {
    const id = this.rpcCounter++;
    this.sendEvent('rpc', { id, func, args });
    return new Promise(resolve => {
      this.rpcResolves[id] = resolve;
    });
  }

  ready() {
    return new Promise(resolve => {
      this.rpcResolves[0] = resolve;
    })
    .then(() => {
      return this.rpc('init', this.props, this.layers);
    });
  }

  train(input, target) {
    return this.rpc('train', input.toJSON(), target);
  }

  getNetwork() {
    return this.rpc('getNetwork').then(json => {
      const net = new Net();
      net.fromJSON({ layers: this.layers });
      // net.fromJSON(json);
      return net;
    });
  }

  close() {
    return this.rpc('close').then(() => {
      setTimeout(() => {
        clearInterval(this.browserHeartBeat);
        this.server.close();
      }, 2000);
    });
  }
}

module.exports = GPUTrainer;
