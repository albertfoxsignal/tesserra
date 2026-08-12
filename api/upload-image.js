// POST /api/upload-image   { path: "assets/team/aiden-kim.jpg", dataUrl: "data:image/jpeg;base64,..." }
// Requires: Authorization: Bearer <token from /api/login>
//
// Replaces (or creates) an image file at the given path in the repo. Since
// every <img> on the site points at a fixed path like assets/team/aiden-kim.jpg,
// overwriting the file at that same path updates the live site with zero
// HTML changes needed.
//
// For safety, this only allows writing inside assets/ — it can't be used
// to overwrite index.html or anything outside the assets folder.

const { requireAuth } = require('./_auth');
const { commitFile } = require('./_github');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAuth(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { path, dataUrl } = body || {};

  if (!path || typeof path !== 'string' || !path.startsWith('assets/')) {
    res.status(400).json({ error: 'path must start with "assets/" — this endpoint only writes image files.' });
    return;
  }
  // Basic path-traversal guard.
  if (path.includes('..')) {
    res.status(400).json({ error: 'Invalid path.' });
    return;
  }
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    res.status(400).json({ error: 'dataUrl must be a base64-encoded image data URL.' });
    return;
  }
  const [, , base64Content] = match;

  try {
    await commitFile(path, base64Content, `Admin CMS: replace image ${path}`);
    res.status(200).json({ ok: true, committedTo: path });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
