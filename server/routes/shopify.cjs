const express = require('express');

const router = express.Router();

const shopifyTokens = new Map();
const shopifyStates = new Map();

function normalizeShopDomain(shop) {
  if (typeof shop !== 'string') return '';
  return shop.replace(/^https?:\/\//i, '').trim();
}

function isValidShopDomain(shop) {
  const normalized = normalizeShopDomain(shop);
  return normalized.endsWith('.myshopify.com');
}

function generateState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

router.get('/integrations/shopify/authorize', (req, res) => {
  const { shop } = req.query;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'https://dev2-8561.myshopify.com/admin/oauth/authorize';
  const scopes = (process.env.SHOPIFY_SCOPES || 'read_all_orders,read_customers,read_price_rules,write_price_rules,read_discounts,write_discounts')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(',');

  if (!clientId) {
    return res.status(400).json({ success: false, error: 'SHOPIFY_CLIENT_ID is required.' });
  }
  const normalizedShop = normalizeShopDomain(shop);
  if (!isValidShopDomain(normalizedShop)) {
    return res.status(400).json({ success: false, error: 'Invalid shop domain. Use *.myshopify.com' });
  }

  const state = generateState();
  shopifyStates.set(normalizedShop, state);

  const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.json({ success: true, url: authUrl });
});

router.get('/integrations/shopify/callback', async (req, res) => {
  const { shop, code, state } = req.query;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const appRedirect = process.env.APP_BASE_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return res.status(400).send('Missing Shopify credentials.');
  }
  const normalizedShop = normalizeShopDomain(shop);
  if (!isValidShopDomain(normalizedShop)) {
    return res.status(400).send('Invalid shop domain.');
  }
  const expectedState = shopifyStates.get(normalizedShop);
  if (!expectedState || expectedState !== state) {
    return res.status(400).send('Invalid OAuth state.');
  }

  try {
    const tokenRes = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(errorText || 'Failed to exchange Shopify token.');
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('No access_token in response.');
    }

    shopifyTokens.set(normalizedShop, tokenData.access_token);
    shopifyStates.delete(normalizedShop);

    res.redirect(`${appRedirect}/?shopify=connected&shop=${encodeURIComponent(normalizedShop)}`);
  } catch (error) {
    res.status(500).send(error.message || 'Shopify OAuth failed.');
  }
});

router.get('/integrations/shopify/status', (req, res) => {
  const { shop } = req.query;
  const normalizedShop = normalizeShopDomain(shop);
  if (!isValidShopDomain(normalizedShop)) {
    return res.status(400).json({ success: false, error: 'Invalid shop domain.' });
  }
  const connected = shopifyTokens.has(normalizedShop);
  res.json({ success: true, connected });
});

module.exports = router;
