const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../auth/jwt.cjs');
const { resolveTenant } = require('../auth/tenantContext.cjs');
const { getRoleFromClaims } = require('../policies/rbac.cjs');

function getTokenFromRequest(req) {
  const authHeader = req.header('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.header('x-auth-token') || null;
}

async function attachUser(req, _res, next) {
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      if (payload?.sub) {
        const tenant = resolveTenant(req, payload);
        req.auth = {
          token,
          claims: payload,
          role: getRoleFromClaims(payload),
          tenant
        };
        req.user = { id: payload.sub, email: payload.email };
        return next();
      }
    } catch {
      // fall back to legacy tokens
      try {
        const legacy = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        if (legacy?.id) {
          const tenant = resolveTenant(req, legacy);
          req.auth = {
            token,
            claims: legacy,
            role: getRoleFromClaims(legacy),
            tenant
          };
          req.user = { id: legacy.id, email: legacy.email };
          return next();
        }
      } catch {
        // ignore
      }
    }
  }

  const userId = req.header('x-user-id') || process.env.DEFAULT_USER_ID || null;
  if (userId) {
    req.user = { id: userId };
  }
  next();
}

function requireAdmin(req, res, next) {
  const token = req.header('x-admin-token') || '';
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected || token !== expected) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  next();
}

function requireTenant(req, res, next) {
  if (!req.auth?.tenant?.orgId) {
    return res.status(403).json({ success: false, error: 'Tenant context required.' });
  }
  next();
}

module.exports = {
  attachUser,
  requireAdmin,
  requireAuth,
  requireTenant,
  getTokenFromRequest
};
