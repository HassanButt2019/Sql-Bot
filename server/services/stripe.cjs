const Stripe = require('stripe');

let stripeClient;

function getStripe() {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }
  stripeClient = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  return stripeClient;
}

module.exports = {
  getStripe
};
