// GET  /api/login-google        -> { enabled, clientId }  (tells the login
//                                   screen whether to show the Google button)
// POST /api/login-google { credential } -> { token, expires }
//
// "Sign in with Google" for the admin panel. The browser gets an ID token
// (a signed JWT) from Google Identity Services and sends it here. We
// verify it SERVER-SIDE with Google's tokeninfo endpoint — client-side
// checks alone prove nothing, since anyone can edit browser JS — and then
// issue the exact same HMAC session token password login issues, so every
// other admin API route works unchanged.
//
// Who gets in is controlled by an email allowlist, not by domain: only
// the addresses listed in ALLOWED_GOOGLE_EMAILS can log in, and only if
// Google reports the email as verified.
//
// Required environment variables (in addition to SESSION_SECRET):
//   GOOGLE_CLIENT_ID       - OAuth 2.0 Web client ID from Google Cloud
//                            Console (ends in .apps.googleusercontent.com)
//   ALLOWED_GOOGLE_EMAILS  - comma-separated list of Google account emails
//                            allowed into the admin, e.g.
//                            "aiden@tesseracompassion.com, albert@foxsignal.dev"
//
// If GOOGLE_CLIENT_ID is not set, the button simply doesn't appear and
// password login continues to work on its own.

const crypto = require('crypto');

function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

module.exports = async (req, res) => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

  if (req.method === 'GET') {
    res.status(200).json({ enabled: !!GOOGLE_CLIENT_ID, clientId: GOOGLE_CLIENT_ID || null });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const SESSION_SECRET = process.env.SESSION_SECRET;
  const ALLOWED = (process.env.ALLOWED_GOOGLE_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  if (!GOOGLE_CLIENT_ID || !SESSION_SECRET) {
    res.status(500).json({ error: 'Google login is not configured: set GOOGLE_CLIENT_ID and SESSION_SECRET.' });
    return;
  }
  if (ALLOWED.length === 0) {
    // An empty allowlist would mean "any Google account in the world" —
    // fail closed instead.
    res.status(500).json({ error: 'Google login is not configured: set ALLOWED_GOOGLE_EMAILS to the emails allowed into the admin.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { credential } = body || {};
  if (!credential || typeof credential !== 'string') {
    res.status(400).json({ error: 'Missing Google credential.' });
    return;
  }

  try {
    // Google validates the JWT's signature and expiry and returns its
    // claims. We still must check the audience ourselves — a valid Google
    // token issued for some OTHER app must not open OUR admin.
    const vRes = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!vRes.ok) {
      res.status(401).json({ error: 'Google sign-in could not be verified. Please try again.' });
      return;
    }
    const info = await vRes.json();

    if (info.aud !== GOOGLE_CLIENT_ID) {
      res.status(401).json({ error: 'This Google sign-in was not issued for this site.' });
      return;
    }
    const email = String(info.email || '').toLowerCase();
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      res.status(401).json({ error: 'This Google account\u2019s email is not verified.' });
      return;
    }
    if (!ALLOWED.includes(email)) {
      // Deliberately the same shape as a wrong password — don't confirm
      // to strangers which emails ARE on the list.
      await new Promise(r => setTimeout(r, 400));
      res.status(401).json({ error: 'This Google account is not authorized for the admin panel.' });
      return;
    }

    const expires = Date.now() + 1000 * 60 * 60 * 8; // same 8 hour session as password login
    const token = sign({ expires, email }, SESSION_SECRET);
    res.status(200).json({ token, expires });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Google to verify the sign-in. Please try again.' });
  }
};
