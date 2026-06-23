import http from 'node:http';

const PUBLIC_PORT = parseInt(process.env.PORT || '3000', 10);
const INTERNAL_PORT = PUBLIC_PORT + 100;

process.env.PORT = String(INTERNAL_PORT);

import('./apps/readest-app/server.js');

function poll(n) {
  http.get(`http://127.0.0.1:${INTERNAL_PORT}/`, (res) => {
    res.resume();
    console.log(`✓ Next.js ready on :${INTERNAL_PORT}, starting proxy`);
    startProxy();
  }).on('error', () => {
    if (n >= 90) return void process.exit(1);
    setTimeout(() => poll(n + 1), 1000);
  });
}

function startProxy() {
  http.createServer((req, res) => {
    const opts = {
      hostname: '127.0.0.1',
      port: INTERNAL_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };
    const preq = http.request(opts, (pres) => {
      pres.headers['access-control-allow-origin'] = '*';
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    });
    preq.on('error', () => res.writeHead(502).end());
    req.pipe(preq);
  }).listen(PUBLIC_PORT, '0.0.0.0', () => {
    console.log(`✓ Proxy on :${PUBLIC_PORT} → :${INTERNAL_PORT}`);
  });
}

setTimeout(() => poll(0), 2000);
