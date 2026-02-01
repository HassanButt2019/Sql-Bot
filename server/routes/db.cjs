const express = require('express');
const { parseConnectionString, testConnection, introspectDatabase, executeQuery } = require('../db/index.cjs');
const { getPlanForUser, checkLimit, incrementUsage, logAudit, logEvent } = require('../db/sqliteStore.cjs');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission } = require('../policies/rbac.cjs');
const crypto = require('crypto');

const router = express.Router();

router.post('/test-connection', requireAuth, requireTenant, requirePermission('connectors:read'), async (req, res) => {
  const startedAt = Date.now();
  const { host, port, username, password, database, dialect, connectionString, useConnectionString } = req.body;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;

  let config = { host, port, username, password, database, dialect };

  if (useConnectionString && connectionString) {
    try {
      config = { ...parseConnectionString(connectionString, dialect), password };
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  try {
    await testConnection(config);
    logEvent(userId, 'db.test-connection', true, { latency_ms: Date.now() - startedAt }, orgId);
    res.json({ success: true, message: 'Connection successful!' });
  } catch (error) {
    logEvent(userId, 'db.test-connection', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/introspect', requireAuth, requireTenant, requirePermission('connectors:read'), async (req, res) => {
  const startedAt = Date.now();
  const { host, port, username, password, database, dialect, connectionString, useConnectionString } = req.body;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const plan = getPlanForUser(userId);
  const limit = checkLimit(userId, 'uploads', plan?.monthly_upload_limit, orgId);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, error: 'Upload limit reached for this month.' });
  }

  console.log('Introspect request received:', { useConnectionString, dialect, host, database });

  let config = { host, port, username, password, database, dialect, ssl: false };

  if (useConnectionString && connectionString) {
    try {
      const parsed = parseConnectionString(connectionString, dialect);
      config = {
        ...parsed,
        username: username || parsed.username,
        password: password || parsed.password,
      };
      console.log('Parsed connection string:', { host: config.host, port: config.port, database: config.database, ssl: config.ssl });
    } catch (error) {
      console.error('Connection string parse error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  try {
    let tables = await introspectDatabase(config);
    incrementUsage(userId, 'uploads', 1, undefined, orgId);
    logAudit(userId, 'db.introspect', { host: config.host, database: config.database, dialect: config.dialect, latency_ms: Date.now() - startedAt }, orgId);
    tables = tables.map((t, index) => ({ ...t, selected: index < 3 }));
    res.json({ success: true, tables, config: { host: config.host, database: config.database, dialect } });
  } catch (error) {
    console.error('Introspection error:', error.message);
    logEvent(userId, 'db.introspect', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/execute-query', requireAuth, requireTenant, requirePermission('queries:run'), async (req, res) => {
  const startedAt = Date.now();
  const { host, port, username, password, database, dialect, query, connectionString, useConnectionString } = req.body;
  const userId = req.user?.id;
  const orgId = req.auth?.tenant?.orgId || null;
  const plan = getPlanForUser(userId);
  const limit = checkLimit(userId, 'queries', plan?.monthly_query_limit, orgId);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, error: 'Query limit reached for this month.' });
  }

  let config = { host, port, username, password, database, dialect };

  if (useConnectionString && connectionString) {
    try {
      config = { ...parseConnectionString(connectionString, dialect), password };
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  try {
    const result = await executeQuery(config, query);
    incrementUsage(userId, 'queries', 1, undefined, orgId);
    const queryHash = query ? crypto.createHash('sha256').update(String(query)).digest('hex') : null;
    logAudit(userId, 'db.execute-query', { database: config.database, dialect: config.dialect, sql_hash: queryHash, latency_ms: Date.now() - startedAt }, orgId);
    logEvent(userId, 'db.execute-query', true, { sql_hash: queryHash, latency_ms: Date.now() - startedAt }, orgId);
    res.json({ success: true, data: result });
  } catch (error) {
    logEvent(userId, 'db.execute-query', false, { error: error.message, latency_ms: Date.now() - startedAt }, orgId);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
