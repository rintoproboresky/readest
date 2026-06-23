import http from 'node:http';
import zlib from 'node:zlib';

const PUBLIC_PORT = parseInt(process.env.PORT || '3000', 10);
const INTERNAL_PORT = PUBLIC_PORT + 100;

process.env.PORT = String(INTERNAL_PORT);

import('./apps/readest-app/server.js');

function poll(n) {
  const req = http.get(`http://127.0.0.1:${INTERNAL_PORT}/`, (res) => {
    res.resume();
    console.log(`✓ Next.js ready on :${INTERNAL_PORT}, starting proxy`);
    startProxy();
  });
  req.on('error', () => {
    if (n >= 90) return void process.exit(1);
    setTimeout(() => poll(n + 1), 1000);
  });
  req.end();
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
      const compress = req.url.startsWith('/_next/static') &&
        (req.headers['accept-encoding'] || '').includes('gzip');
      if (!compress) {
        res.writeHead(pres.statusCode, pres.headers);
        return pres.pipe(res);
      }
      const chunks = [];
      pres.on('data', (c) => chunks.push(c));
      pres.on('end', () => {
        zlib.gzip(Buffer.concat(chunks), (err, buf) => {
          if (err) { res.writeHead(500).end(); return; }
          const h = { ...pres.headers };
          h['content-encoding'] = 'gzip';
          h['vary'] = 'accept-encoding';
          delete h['content-length'];
          res.writeHead(pres.statusCode, h);
          res.end(buf);
        });
      });
    });
    preq.on('error', () => res.writeHead(502).end());
    req.pipe(preq);
  }).listen(PUBLIC_PORT, '0.0.0.0', () => {
    console.log(`✓ Compressing proxy on :${PUBLIC_PORT} → :${INTERNAL_PORT}`);
  });
}

setTimeout(() => poll(0), 2000);
