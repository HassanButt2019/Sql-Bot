const jwt = require('jsonwebtoken');

function issueCapabilityToken(payload, expiresInSeconds = 300) {
  const secret = process.env.CAPABILITY_SECRET;
  if (!secret) {
    throw new Error('CAPABILITY_SECRET is required');
  }
  return jwt.sign(
    {
      org_id: payload.org_id,
      allowed_actions: payload.allowed_actions || [],
      allowed_connector_ids: payload.allowed_connector_ids || [],
      dataset_allowlist: payload.dataset_allowlist || []
    },
    secret,
    { expiresIn: expiresInSeconds }
  );
}

function verifyCapabilityToken(token, expected = {}) {
  const secret = process.env.CAPABILITY_SECRET;
  if (!secret) {
    throw new Error('CAPABILITY_SECRET is required');
  }
  const decoded = jwt.verify(token, secret);
  if (expected.org_id && decoded.org_id !== expected.org_id) {
    throw new Error('Capability token org mismatch');
  }
  if (expected.action && !decoded.allowed_actions?.includes(expected.action)) {
    throw new Error('Capability token missing action');
  }
  return decoded;
}

module.exports = {
  issueCapabilityToken,
  verifyCapabilityToken
};
