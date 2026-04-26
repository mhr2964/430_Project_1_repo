import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolved once at startup — all file requests must stay inside this directory
const CLIENT_DIR = path.resolve(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/**
 * Serves a static file from the client directory.
 * Rejects path traversal attempts that escape CLIENT_DIR.
 */
const serveFile = (res, relPath) => {
  const resolved = path.resolve(CLIENT_DIR, relPath);

  // Path traversal guard — resolved path must stay inside CLIENT_DIR
  if (!resolved.startsWith(CLIENT_DIR + path.sep) && resolved !== CLIENT_DIR) {
    const body = 'Forbidden';
    res.writeHead(403, {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      const body = 'Not Found';
      res.writeHead(404, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }
    const ext = path.extname(resolved);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.byteLength,
    });
    res.end(data);
  });
};

export { serveFile };
