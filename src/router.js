import { serveFile } from './fileServer.js';
import {
  getPokemon, getPokemonById, getTypes, getWeaknesses,
  addPokemon, updatePokemon, notFound,
} from './api.js';
import { sendError } from './responses.js';

/**
 * Wraps an async handler call so any unexpected rejection sends a 500
 * instead of becoming an unhandled Promise rejection that crashes Node.
 */
const safeAsync = (promise, req, res) => {
  promise.catch((err) => {
    console.error('Unhandled handler error:', err);
    if (!res.headersSent) sendError(req, res, 500, 'Internal server error');
  });
};

/**
 * Routes an incoming HTTP request to the appropriate handler.
 *
 * Static routes: /, /docs, /style.css, /main.js
 * API routes:    /api/pokemon, /api/pokemon/:id, /api/pokemon/update,
 *                /api/types, /api/weaknesses
 */
const handleRequest = (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  const { pathname } = reqUrl;
  const query = Object.fromEntries(reqUrl.searchParams.entries());
  const method = req.method.toUpperCase();

  // --- Static file routes ---
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile(res, 'index.html');
  }
  if (pathname === '/docs' || pathname === '/docs.html') {
    return serveFile(res, 'docs.html');
  }
  if (pathname === '/style.css') {
    return serveFile(res, 'style.css');
  }
  if (pathname === '/main.js') {
    return serveFile(res, 'main.js');
  }

  // --- API routes ---
  // segments: e.g. ['api', 'pokemon', '25'] after splitting on '/' and dropping empties
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'api') {
    return notFound(req, res);
  }

  const resource = segments[1];

  if (resource === 'pokemon') {
    const subpath = segments[2];

    if (!subpath) {
      if (method === 'GET' || method === 'HEAD') return getPokemon(req, res, query);
      if (method === 'POST') return safeAsync(addPokemon(req, res), req, res);
      return sendError(req, res, 405, 'Method not allowed');
    }

    if (subpath === 'update') {
      if (method === 'POST') return safeAsync(updatePokemon(req, res), req, res);
      return sendError(req, res, 405, 'Method not allowed');
    }

    // /api/pokemon/:id — numeric id or "001" num string
    if (method === 'GET' || method === 'HEAD') return getPokemonById(req, res, subpath);
    return sendError(req, res, 405, 'Method not allowed');
  }

  if (resource === 'types') {
    if (method === 'GET' || method === 'HEAD') return getTypes(req, res);
    return sendError(req, res, 405, 'Method not allowed');
  }

  if (resource === 'weaknesses') {
    if (method === 'GET' || method === 'HEAD') return getWeaknesses(req, res);
    return sendError(req, res, 405, 'Method not allowed');
  }

  return notFound(req, res);
};

export { handleRequest };
