const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  const root = path.join(__dirname, '..', '..');
  const mode = process.env.NODE_ENV || 'development';
  const files = [
    '.env',
    '.env.local',
    `.env.${mode}`,
    `.env.${mode}.local`
  ];

  for (const file of files) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: true });
    }
  }
}

function validateEnv() {
  if ((process.env.NODE_ENV || 'development') !== 'production') return;
  const required = [
    'OIDC_ISSUER',
    'OIDC_AUDIENCE',
    'OIDC_JWKS_URI',
    'CAPABILITY_SECRET',
    'SECRETS_MASTER_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  if (missing.length) {
    throw new Error(`Missing required env vars for production: ${missing.join(', ')}`);
  }
}

module.exports = {
  loadEnv,
  validateEnv
};
