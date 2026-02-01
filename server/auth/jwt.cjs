const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const DEFAULT_CLOCK_SKEW_SECONDS = 60;

function buildJwksClient() {
  const jwksUri = process.env.OIDC_JWKS_URI;
  if (!jwksUri) {
    return null;
  }
  return jwksRsa({
    jwksUri,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10
  });
}

const jwksClient = buildJwksClient();

function getKey(header, callback) {
  if (!jwksClient) {
    return callback(new Error('JWKS client not configured'));
  }
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyAccessToken(token) {
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  if (!issuer || !audience) {
    throw new Error('OIDC_ISSUER and OIDC_AUDIENCE must be configured');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer,
        audience,
        clockTolerance: DEFAULT_CLOCK_SKEW_SECONDS
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

module.exports = {
  verifyAccessToken
};
