const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');

const router = express.Router();

router.get('/me', requireAuth, requireTenant, (req, res) => {
  const claims = req.auth?.claims || {};
  const tenant = req.auth?.tenant || {};
  res.json({
    success: true,
    data: {
      user: {
        id: req.user?.id,
        email: req.user?.email || claims.email || null,
        name: claims.name || null
      },
      org: {
        id: tenant.orgId,
        memberships: tenant.orgIds || []
      },
      role: req.auth?.role || 'Viewer'
    }
  });
});

module.exports = router;
