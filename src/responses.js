/**
 * Sends an HTTP response with Content-Type and Content-Length set.
 * For HEAD requests the headers are sent but the body is omitted.
 */
const sendResponse = (req, res, statusCode, contentType, body) => {
  const bodyBuffer = Buffer.from(body);
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': bodyBuffer.byteLength,
  });
  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(body);
  }
};

/** Serializes data as JSON and sends it. */
const sendJSON = (req, res, statusCode, data) => {
  sendResponse(req, res, statusCode, 'application/json', JSON.stringify(data));
};

/** Sends 204 No Content — no body, no Content-Type needed. */
const sendNoContent = (res) => {
  res.writeHead(204, { 'Content-Length': '0' });
  res.end();
};

/** Sends a JSON body with a single `error` field. */
const sendError = (req, res, statusCode, message) => {
  sendJSON(req, res, statusCode, { error: message });
};

export {
  sendResponse, sendJSON, sendNoContent, sendError,
};
