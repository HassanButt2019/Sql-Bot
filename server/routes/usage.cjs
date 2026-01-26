const express = require('express');
const { requireAdmin, requireAuth, requireTenant } = require('../middleware/auth.cjs');
const {
  ensureUser,
  getPlanForUser,
  getUsage,
  listAuditLogs,
  getAnalyticsSummary,
  updatePlan
} = require('../db/sqliteStore.cjs');

const router = express.Router();

router.get('/usage/limits', requireAuth, requireTenant, (req, res) => {
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const user = ensureUser(userId);
  const plan = getPlanForUser(userId);
  res.json({
    success: true,
    data: {
      user,
      plan,
      usage: {
        queries: getUsage(userId, 'queries', undefined, orgId),
        dashboards: getUsage(userId, 'dashboards', undefined, orgId),
        uploads: getUsage(userId, 'uploads', undefined, orgId)
      }
    }
  });
});

router.post('/usage/limits', requireAuth, requireTenant, (req, res) => {
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const user = ensureUser(userId);
  const plan = getPlanForUser(userId);
  res.json({
    success: true,
    data: {
      user,
      plan,
      usage: {
        queries: getUsage(userId, 'queries', undefined, orgId),
        dashboards: getUsage(userId, 'dashboards', undefined, orgId),
        uploads: getUsage(userId, 'uploads', undefined, orgId)
      }
    }
  });
});

router.get('/audit', requireAuth, requireTenant, (req, res) => {
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const logs = listAuditLogs(userId, 200, orgId);
  res.json({ success: true, data: logs });
});

router.post('/audit', requireAuth, requireTenant, (req, res) => {
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const logs = listAuditLogs(userId, 200, orgId);
  res.json({ success: true, data: logs });
});

router.get('/analytics/summary', requireAuth, requireTenant, (req, res) => {
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const summary = getAnalyticsSummary(userId, orgId);
  res.json({ success: true, data: summary });
});

router.post('/analytics/summary', requireAuth, requireTenant, (req, res) => {
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const summary = getAnalyticsSummary(userId, orgId);
  res.json({ success: true, data: summary });
});

router.post('/admin/plans/:planId', requireAdmin, (req, res) => {
  const { planId } = req.params;
  try {
    const updated = updatePlan(planId, req.body || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
