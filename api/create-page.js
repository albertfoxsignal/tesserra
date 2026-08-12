// POST /api/create-page   { slug: "our-partners-event", title: "Our Partners Event", html: "<full page HTML>" }
// Requires: Authorization: Bearer <token from /api/login>
//
// Saves the uploaded HTML as pages/<slug>.html and registers it in
// data/custom-pages.json, which the live site's nav reads to add a link
// automatically — no other file needs to change.

const { requireAuth } = require('./_auth');
const { commitFile, getFileSha } = require('./_github');

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

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
  const { title, html } = body || {};
  let { slug } = body || {};

  if (!title || !html) {
    res.status(400).json({ error: 'title and html are required.' });
    return;
  }
  slug = slugify(slug || title);
  if (!slug) {
    res.status(400).json({ error: 'Could not derive a valid page slug from the title.' });
    return;
  }

  const filePath = `pages/${slug}.html`;

  try {
    // 1. Write the new page's HTML.
    const contentBase64 = Buffer.from(html, 'utf-8').toString('base64');
    await commitFile(filePath, contentBase64, `Admin CMS: create page ${filePath}`);

    // 2. Register it in data/custom-pages.json so the live nav picks it up.
    const branch = process.env.GITHUB_BRANCH || 'main';
    const registryPath = 'data/custom-pages.json';
    let registry = [];
    const sha = await getFileSha(registryPath, branch);
    if (sha) {
      const repo = process.env.GITHUB_REPO;
      const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${registryPath}`);
      if (raw.ok) {
        try { registry = await raw.json(); } catch (e) { registry = []; }
      }
    }
    registry = registry.filter(p => p.slug !== slug);
    registry.push({ slug, title, path: filePath, addedAt: new Date().toISOString() });

    const registryBase64 = Buffer.from(JSON.stringify(registry, null, 2), 'utf-8').toString('base64');
    await commitFile(registryPath, registryBase64, `Admin CMS: register page ${slug}`);

    res.status(200).json({ ok: true, slug, path: filePath, url: `/pages/${slug}.html` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
