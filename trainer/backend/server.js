const Http = require('http');
const Fs = require('fs');
const Path = require('Path');
const opn = require('opn');
const eventStream = require('./event-stream');

const server = Http.createServer((req, res) => {
  switch (req.url) {
    case '/':
      res.writeHead(200, { 'content-type': 'text/html' });
      Fs.createReadStream(abspath('frontend', 'index.html')).pipe(res);
      break;
    case '/event-stream':
      eventStream.attach(res);
      break;
  }
});
server.listen(() => {
  // opn(`http://localhost:${server.address().port}/`);
});
