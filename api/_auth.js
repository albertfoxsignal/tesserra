// Shared helper used by every admin-only API route to verify the session
// token issued by /api/login. Not a route itself — required by the others.

const crypto = require('crypto');

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.expires && payload.expires > Date.now();
  } catch (e) {
    return false;
  }
}

// Call this at the top of any protected route. Returns true and lets the
// route continue if authorized; sends a 401 and returns false otherwise.
function requireAuth(req, res) {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!SESSION_SECRET || !verifyToken(token, SESSION_SECRET)) {
    res.status(401).json({ error: 'Not authorized. Please log in again.' });
    return false;
  }
  return true;
}

module.exports = { requireAuth, verifyToken };
