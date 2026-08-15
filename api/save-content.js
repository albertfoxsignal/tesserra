// POST /api/save-content   { file: "translations" | "pages" | "elders" | "visibility" | "builder", data: {...} }
// Requires: Authorization: Bearer <token from /api/login>
//
// Writes the given file to data/<file>.json in your GitHub repo. Vercel
// picks up the commit and redeploys automatically — the live site will
// show the change once that redeploy finishes (usually under a minute).

const { requireAuth } = require('./_auth');
const { commitFile } = require('./_github');

const ALLOWED_FILES = {
  translations: 'data/translations.json',
  pages: 'data/pages.json',
  elders: 'data/elders.json',
  visibility: 'data/section-visibility.json',
  builder: 'data/page-builder.json',
};

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
  const { file, data } = body || {};

  const filePath = ALLOWED_FILES[file];
  if (!filePath) {
    res.status(400).json({ error: `Unknown file "${file}". Must be one of: ${Object.keys(ALLOWED_FILES).join(', ')}` });
    return;
  }
  if (data === undefined) {
    res.status(400).json({ error: 'Missing "data" in request body.' });
    return;
  }

  try {
    const json = JSON.stringify(data, null, 2);
    const contentBase64 = Buffer.from(json, 'utf-8').toString('base64');
    await commitFile(filePath, contentBase64, `Admin CMS: update ${filePath}`);
    res.status(200).json({ ok: true, committedTo: filePath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
