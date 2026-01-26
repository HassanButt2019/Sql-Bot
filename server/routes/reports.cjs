const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission } = require('../policies/rbac.cjs');

const router = express.Router();

router.post('/reports/schedule', requireAuth, requireTenant, requirePermission('dashboards:share'), async (req, res) => {
  const { dashboardId, dashboardTitle, frequency, time, email, format } = req.body;

  if (!dashboardId || !email || !frequency) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: dashboardId, email, and frequency are required'
    });
  }

  const schedule = {
    id: Date.now().toString(),
    dashboardId,
    dashboardTitle,
    frequency,
    time: time || '09:00',
    email,
    format: format || 'pdf',
    enabled: true,
    createdAt: Date.now(),
    nextRun: calculateNextRun(frequency, time)
  };

  console.log('📅 Report schedule created:', schedule);

  res.json({
    success: true,
    schedule,
    message: 'Schedule created. Note: Email delivery requires additional backend setup (SendGrid, AWS SES, etc.)'
  });
});

router.get('/reports/schedules', requireAuth, requireTenant, requirePermission('dashboards:read'), (_req, res) => {
  res.json({
    success: true,
    schedules: [],
    message: 'Schedules are currently stored in browser localStorage. Backend storage coming soon.'
  });
});

router.post('/reports/send', requireAuth, requireTenant, requirePermission('dashboards:share'), async (req, res) => {
  const { dashboardId, email, format } = req.body;

  console.log('📧 Manual report send requested:', { dashboardId, email, format });

  res.json({
    success: true,
    message: 'Report send initiated. Email delivery requires backend email service integration.'
  });
});

function calculateNextRun(frequency, time) {
  const now = new Date();
  const [hours, minutes] = (time || '09:00').split(':').map(Number);

  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= now) {
    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
  }

  return nextRun.toISOString();
}

module.exports = router;
