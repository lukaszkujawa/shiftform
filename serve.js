import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.mp3': 'audio/mpeg', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const root = new URL('.', import.meta.url).pathname;
const port = Number(process.env.PORT) || 8080;

createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(req.url.split('?')[0]));
    const file = join(root, path === '/' ? 'index.html' : path);
    const body = await readFile(file);
    const headers = { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!range) {
      res.writeHead(200, headers);
      res.end(body);
      return;
    }
    const start = range[1] ? +range[1] : Math.max(0, body.length - +range[2]);
    const end = range[1] && range[2] ? Math.min(+range[2], body.length - 1) : body.length - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}` });
    res.end(body.subarray(start, end + 1));
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
