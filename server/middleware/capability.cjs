const { verifyCapabilityToken } = require('../ai/capabilities.cjs');
const { extractSchemaTables } = require('../utils/schemaTables.cjs');

function requireCapability(action) {
  return (req, res, next) => {
    const token = req.header('x-capability-token');
    if (!token) {
      return res.status(403).json({ success: false, error: 'Capability token required.' });
    }
    try {
      const orgId = req.auth?.tenant?.orgId;
      const decoded = verifyCapabilityToken(token, { org_id: orgId, action });
      req.capability = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ success: false, error: err.message });
    }
  };
}

function assertCapabilityScope(req, options = {}) {
  const capability = req.capability;
  if (!capability) return;
  const connectorId = options.connectorId;
  const allowlist = capability.allowed_connector_ids || [];
  if (allowlist.length) {
    if (!connectorId) {
      throw new Error('Capability token requires a connector scope.');
    }
    if (!allowlist.includes(connectorId)) {
      throw new Error('Connector not allowed by capability token.');
    }
  }

  const datasetAllowlist = (capability.dataset_allowlist || []).map(item => String(item).toLowerCase());
  if (datasetAllowlist.length) {
    const tables = options.schemaContext ? extractSchemaTables(options.schemaContext) : [];
    const normalizedAllow = new Set(datasetAllowlist);
    for (const table of tables) {
      const normalized = table.toLowerCase();
      const base = normalized.split('.').pop();
      if (!normalizedAllow.has(normalized) && !normalizedAllow.has(base)) {
        throw new Error(`Dataset "${table}" is not allowed by capability token.`);
      }
    }
  }
}

module.exports = {
  requireCapability,
  assertCapabilityScope
};
