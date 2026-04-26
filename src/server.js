import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleRequest } from './router.js';
import { setData } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Load the dataset into memory once at startup — all API access reads from this object
const rawData = fs.readFileSync(path.join(__dirname, 'data', 'pokedex.json'), 'utf8');
setData(JSON.parse(rawData));

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
