import {
  sendJSON, sendNoContent, sendError,
} from './responses.js';

// In-memory dataset — loaded once at startup, mutated by POST endpoints
let pokemon = [];

/** Initializes the dataset from the parsed JSON file (called by server.js at startup). */
const setData = (data) => {
  pokemon = [...data];
};

/**
 * Parses the request body based on Content-Type.
 * Supports application/json and application/x-www-form-urlencoded.
 * For form data, comma-separated values in `type` and `weaknesses` are split into arrays.
 */
const parseBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const bodyStr = Buffer.concat(chunks).toString();
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      try {
        resolve(JSON.parse(bodyStr));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyStr);
      const obj = {};
      for (const [key, value] of params) {
        // Array fields sent as comma-separated strings in form data
        if (key === 'type' || key === 'weaknesses') {
          obj[key] = value.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          obj[key] = value;
        }
      }
      resolve(obj);
    } else {
      resolve({});
    }
  });
  req.on('error', reject);
});

/**
 * GET/HEAD /api/pokemon
 * Returns all pokemon. Supports query params:
 *   type     (string)  — filter to pokemon that have this type
 *   weakness (string)  — filter to pokemon that have this weakness
 *   name     (string)  — filter to pokemon whose name contains this substring (case-insensitive)
 *   limit    (number)  — max number of results to return
 */
const getPokemon = (req, res, query) => {
  let results = [...pokemon];

  if (query.type) {
    const t = query.type.toLowerCase();
    results = results.filter((p) => p.type.some((t2) => t2.toLowerCase() === t));
  }

  if (query.weakness) {
    const w = query.weakness.toLowerCase();
    results = results.filter((p) => p.weaknesses.some((w2) => w2.toLowerCase() === w));
  }

  if (query.name) {
    const n = query.name.toLowerCase();
    results = results.filter((p) => p.name.toLowerCase().includes(n));
  }

  if (query.limit) {
    const lim = parseInt(query.limit, 10);
    if (!Number.isNaN(lim) && lim > 0) {
      results = results.slice(0, lim);
    }
  }

  sendJSON(req, res, 200, { count: results.length, pokemon: results });
};

/**
 * GET/HEAD /api/pokemon/:id
 * Returns a single pokemon by numeric id (1–151) or zero-padded num string ("001").
 */
const getPokemonById = (req, res, id) => {
  const numericId = parseInt(id, 10);
  let found;

  if (!Number.isNaN(numericId)) {
    found = pokemon.find((p) => p.id === numericId);
  } else {
    found = pokemon.find((p) => p.num === id);
  }

  if (!found) {
    sendError(req, res, 404, `No pokemon found with id: ${id}`);
    return;
  }

  sendJSON(req, res, 200, found);
};

/**
 * GET/HEAD /api/types
 * Returns a sorted array of all unique pokemon types in the dataset.
 */
const getTypes = (req, res) => {
  const types = [...new Set(pokemon.flatMap((p) => p.type))].sort();
  sendJSON(req, res, 200, { types });
};

/**
 * GET/HEAD /api/weaknesses
 * Returns a sorted array of all unique pokemon weaknesses in the dataset.
 */
const getWeaknesses = (req, res) => {
  const weaknesses = [...new Set(pokemon.flatMap((p) => p.weaknesses))].sort();
  sendJSON(req, res, 200, { weaknesses });
};

/**
 * POST /api/pokemon
 * Adds a new pokemon to the in-memory dataset.
 * Required body fields: name (string), type (array of strings)
 * Optional: height, weight, weaknesses, img, next_evolution
 * Responds 201 with the created pokemon object.
 */
const addPokemon = async (req, res) => {
  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    sendError(req, res, 400, e.message);
    return;
  }

  const { name, type, height, weight, weaknesses } = body;

  if (!name || !type || !Array.isArray(type) || type.length === 0) {
    sendError(req, res, 400, 'name and type (array) are required');
    return;
  }

  const newId = Math.max(...pokemon.map((p) => p.id)) + 1;
  const newPokemon = {
    id: newId,
    num: String(newId).padStart(3, '0'),
    name,
    img: body.img || '',
    type,
    height: height || 'unknown',
    weight: weight || 'unknown',
    weaknesses: Array.isArray(weaknesses) ? weaknesses : [],
    next_evolution: body.next_evolution || [],
  };

  pokemon.push(newPokemon);
  sendJSON(req, res, 201, newPokemon);
};

/**
 * POST /api/pokemon/update
 * Updates fields on an existing pokemon identified by id.
 * Required body field: id (number)
 * Optional updatable fields: name, type, height, weight, weaknesses, img, next_evolution
 * Responds 204 on success, 400 on bad input, 404 if not found.
 */
const updatePokemon = async (req, res) => {
  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    sendError(req, res, 400, e.message);
    return;
  }

  const id = parseInt(body.id, 10);
  if (!body.id || Number.isNaN(id)) {
    sendError(req, res, 400, 'id (number) is required');
    return;
  }

  const idx = pokemon.findIndex((p) => p.id === id);
  if (idx === -1) {
    sendError(req, res, 404, `No pokemon found with id: ${id}`);
    return;
  }

  const updatable = ['name', 'type', 'height', 'weight', 'weaknesses', 'img', 'next_evolution'];
  updatable.forEach((field) => {
    if (body[field] !== undefined) {
      pokemon[idx][field] = body[field];
    }
  });

  sendNoContent(res);
};

/** Responds 404 for any unrecognized endpoint. */
const notFound = (req, res) => {
  sendError(req, res, 404, 'Endpoint not found');
};

export {
  setData, getPokemon, getPokemonById, getTypes, getWeaknesses,
  addPokemon, updatePokemon, notFound,
};
