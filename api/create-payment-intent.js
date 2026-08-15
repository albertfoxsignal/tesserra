// POST /create-payment-intent   { amount: 5000, currency: "usd", name, email }
// (also reachable at /api/create-payment-intent — see vercel.json rewrite)
//
// Creates a Stripe PaymentIntent and returns { clientSecret } for the
// donation form to confirm the card payment in the browser. This is the
// one Stripe step that MUST run on a server: it uses the SECRET key,
// which can charge cards and issue refunds, so it lives only in an
// environment variable and never in any committed file.
//
// Uses Stripe's REST API directly via fetch, so the repo needs no npm
// dependencies or package.json — the function deploys as-is.
//
// Required environment variable:
//   STRIPE_SECRET_KEY - sk_live_... (or sk_test_... while testing)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    res.status(500).json({ error: 'Server not configured: set STRIPE_SECRET_KEY in your hosting environment variables.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { amount, currency, name, email } = body || {};

  // Amount arrives in cents from the donation form. Bound it server-side:
  // the client is not trusted, and a mistyped or malicious amount should
  // fail here rather than reach Stripe.
  const cents = Number(amount);
  if (!Number.isInteger(cents) || cents < 100 || cents > 5000000) {
    res.status(400).json({ error: 'Amount must be between $1 and $50,000.' });
    return;
  }

  const params = new URLSearchParams();
  params.set('amount', String(cents));
  params.set('currency', (currency || 'usd').toLowerCase());
  params.set('description', 'Donation to Tessera Compassion Foundation');
  if (email) params.set('receipt_email', String(email).slice(0, 200));
  if (name) params.set('metadata[donor_name]', String(name).slice(0, 200));
  params.set('automatic_payment_methods[enabled]', 'true');
  // The embedded card form confirms on-page; disallow redirect-based
  // methods so confirmCardPayment never needs a return_url.
  params.set('automatic_payment_methods[allow_redirects]', 'never');

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      // Pass Stripe's message through without the raw object (it can
      // contain request ids and internals the donor doesn't need).
      res.status(502).json({ error: (data.error && data.error.message) || 'Payment could not be initialized.' });
      return;
    }
    res.status(200).json({ clientSecret: data.client_secret });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the payment provider. Please try again.' });
  }
};
