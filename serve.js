#!/usr/bin/env node
/**
 * Lightweight static server for the Yeti Burger Jumper prototype.
 * Usage: node serve.js --port 3000
 */
import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const defaultPort = Number.parseInt(process.env.PORT || '3000', 10);
const port = getArgValue('--port', defaultPort);
const baseDir = process.cwd();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const server = createServer(async (req, res) => {
  const parsed = url.parse(req.url || '/');
  const safePath = path
    .normalize(decodeURIComponent(parsed.pathname || '/'))
    .replace(/^([/\\]*\.\.)+/, '/');

  let filePath = path.join(baseDir, safePath);

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (err) {
    // ignore and fall back to 404 handling
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
    logRequest(parsed.pathname || '/', 200);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    logRequest(parsed.pathname || '/', 404);
  }
});

server.listen(port, () => {
  console.log(`🍔 Статический сервер запущен на http://localhost:${port}`);
  console.log('Нажмите Ctrl+C чтобы остановить.');
});

function getArgValue(flag, fallback) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    const value = Number.parseInt(args[index + 1], 10);
    if (!Number.isNaN(value)) return value;
  }
  return fallback;
}

function printHelp() {
  console.log('Yeti Burger Jumper — статический сервер');
  console.log('Использование: node serve.js [--port <число>]');
  console.log('По умолчанию порт 3000 или значение env PORT.');
}

function logRequest(route, status) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${status} ${route}`);
}
