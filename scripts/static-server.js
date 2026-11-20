import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leaderboardMiddleware } from './leaderboard-store.js';

export const distPath = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4',
};

async function serve(request, response, root) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end('Method not allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid URL');
    return;
  }
  const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + sep)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const info = await stat(file).catch(error => error.code === 'ENOENT' || error.code === 'ENOTDIR' ? null : Promise.reject(error));
  if (!info?.isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size,
  });
  if (request.method === 'HEAD') return response.end();
  createReadStream(file).on('error', () => response.destroy()).pipe(response);
}

export async function startStaticServer({ port = 0, host = '127.0.0.1', directory = distPath,
  useLeaderboard = false, route } = {}) {
  const root = resolve(directory);
  const server = createServer((request, response) => {
    const next = () => serve(request, response, root).catch(error => {
      console.error(error.message);
      if (!response.headersSent) response.writeHead(500).end('Server error');
      else response.destroy();
    });
    if (route?.(request, response)) return;
    if (useLeaderboard) leaderboardMiddleware(request, response, next);
    else next();
  });
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(port, host, ready);
  });
  const info = server.address();
  return { server, url: 'http://' + host + ':' + info.port };
}
