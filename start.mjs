import http from 'node:http';
import zlib from 'node:zlib';

const PUBLIC_PORT = parseInt(process.env.PORT || '3000', 10);
const INTERNAL_PORT = PUBLIC_PORT + 100;

process.env.PORT = String(INTERNAL_PORT);

// Start Next.js standalone server on the internal port
import('./apps/readest-app/server.js');

function poll(n) {
  const req = http.get(`http://127.0.0.1:${INTERNAL_PORT}/`, (res) => {
    res.resume();
    console.log(`✓ Next.js ready on :${INTERNAL_PORT}, starting proxy`);
    startProxy();
  });
  req.on('error', () => {
    if (n >= 90) {
      console.error('Timed out waiting for Next.js');
      process.exit(1);
    }
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
    const proxyReq = http.request(opts, (proxyRes) => {
      if (req.url.startsWith('/_next/static') && (req.headers['accept-encoding'] || '').includes('gzip')) {
        const headers = { ...proxyRes.headers };
        headers['content-encoding'] = 'gzip';
        headers['vary'] = 'accept-encoding';
        delete headers['content-length'];
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });
    proxyReq.on('error', () => res.writeHead(502).end());
    req.pipe(proxyReq);
  }).listen(PUBLIC_PORT, '0.0.0.0', () => {
    console.log(`✓ Compressing proxy on :${PUBLIC_PORT} → :${INTERNAL_PORT}`);
  });
}

setTimeout(() => poll(0), 2000);
