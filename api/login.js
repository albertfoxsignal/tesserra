// POST /api/login  { password: "..." }
// Verifies the admin password SERVER-SIDE (never trust a client-side-only
// password check — anyone can read your JS and bypass it) and, if correct,
// issues a signed session token the browser stores and sends back on every
// other admin API call.
//
// Required Vercel environment variables (Project Settings -> Environment Variables):
//   ADMIN_PASSWORD   - the admin password
//   SESSION_SECRET   - any long random string, used to sign tokens (e.g. generate
//                      one with: openssl rand -hex 32)

const crypto = require('crypto');

function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SESSION_SECRET = process.env.SESSION_SECRET;

  if (!ADMIN_PASSWORD || !SESSION_SECRET) {
    res.status(500).json({ error: 'Server not configured: set ADMIN_PASSWORD and SESSION_SECRET in Vercel environment variables.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { password } = body || {};

  if (!password || password !== ADMIN_PASSWORD) {
    // Small delay to make brute-forcing marginally slower.
    await new Promise(r => setTimeout(r, 400));
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  const expires = Date.now() + 1000 * 60 * 60 * 8; // 8 hour session
  const token = sign({ expires }, SESSION_SECRET);

  res.status(200).json({ token, expires });
};
