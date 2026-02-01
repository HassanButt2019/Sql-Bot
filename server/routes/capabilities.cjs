const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission, getPermissionsForRole } = require('../policies/rbac.cjs');
const { issueCapabilityToken } = require('../ai/capabilities.cjs');

const router = express.Router();

router.post('/capabilities', requireAuth, requireTenant, requirePermission('dashboards:create'), (req, res) => {
  const orgId = req.auth?.tenant?.orgId;
  const { allowed_actions = [], allowed_connector_ids = [], dataset_allowlist = [] } = req.body || {};
  const role = req.auth?.role || 'Viewer';
  const permissions = getPermissionsForRole(role);
  const requiredByAction = {
    'dashboard.generate': 'dashboards:create',
    'dashboard.update': 'dashboards:update'
  };
  for (const action of allowed_actions) {
    const required = requiredByAction[action];
    if (required && !permissions.includes(required)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions for capability action.' });
    }
  }
  const token = issueCapabilityToken({
    org_id: orgId,
    allowed_actions,
    allowed_connector_ids,
    dataset_allowlist
  }, 300);
  res.json({ success: true, data: { token, expires_in: 300 } });
});

module.exports = router;
