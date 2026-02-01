const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth.cjs');
const { requirePermission } = require('../policies/rbac.cjs');
const { storeSecret, getSecret } = require('../secrets/secretsStore.cjs');
const { testConnection, introspectDatabase } = require('../db/index.cjs');
const {
  listConnectorsByOrg,
  getConnectorById,
  createConnector,
  updateConnector,
  deleteConnector,
  logAudit
} = require('../db/sqliteStore.cjs');

const router = express.Router();

router.get('/connectors', requireAuth, requireTenant, requirePermission('connectors:read'), (req, res) => {
  const orgId = req.auth.tenant.orgId;
  const connectors = listConnectorsByOrg(orgId);
  res.json({ success: true, data: connectors });
});

router.post('/connectors', requireAuth, requireTenant, requirePermission('connectors:create'), async (req, res) => {
  const orgId = req.auth.tenant.orgId;
  const { name, host, port, username, password, database, dialect } = req.body || {};
  if (!name || !host || !username || !password || !database || !dialect) {
    return res.status(400).json({ success: false, error: 'Missing required connector fields.' });
  }
  const connectorId = `conn_${Date.now()}`;
  const secretId = `sec_${Date.now()}`;
  storeSecret({ id: secretId, orgId, kind: 'db', value: { username, password } });
  const connector = createConnector({
    id: connectorId,
    org_id: orgId,
    name,
    host,
    port: port || '',
    database,
    dialect,
    secret_id: secretId
  });
  logAudit(req.user?.id, 'connector.create', { connectorId, name }, orgId);
  res.json({ success: true, data: connector });
});

router.patch('/connectors/:id', requireAuth, requireTenant, requirePermission('connectors:update'), (req, res) => {
  const orgId = req.auth.tenant.orgId;
  const connectorId = req.params.id;
  try {
    const updated = updateConnector(connectorId, orgId, req.body || {});
    logAudit(req.user?.id, 'connector.update', { connectorId }, orgId);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.delete('/connectors/:id', requireAuth, requireTenant, requirePermission('connectors:delete'), (req, res) => {
  const orgId = req.auth.tenant.orgId;
  const connectorId = req.params.id;
  try {
    deleteConnector(connectorId, orgId);
    logAudit(req.user?.id, 'connector.delete', { connectorId }, orgId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/connectors/:id/test', requireAuth, requireTenant, requirePermission('connectors:read'), async (req, res) => {
  const orgId = req.auth.tenant.orgId;
  const connectorId = req.params.id;
  const connector = getConnectorById(connectorId, orgId);
  if (!connector) return res.status(404).json({ success: false, error: 'Connector not found' });
  const secret = getSecret(connector.secret_id, orgId);
  if (!secret) return res.status(404).json({ success: false, error: 'Secret not found' });
  try {
    await testConnection({
      host: connector.host,
      port: connector.port,
      username: secret.username,
      password: secret.password,
      database: connector.database,
      dialect: connector.dialect
    });
    logAudit(req.user?.id, 'connector.test', { connectorId }, orgId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/connectors/:id/introspect', requireAuth, requireTenant, requirePermission('connectors:read'), async (req, res) => {
  const orgId = req.auth.tenant.orgId;
  const connectorId = req.params.id;
  const connector = getConnectorById(connectorId, orgId);
  if (!connector) return res.status(404).json({ success: false, error: 'Connector not found' });
  const secret = getSecret(connector.secret_id, orgId);
  if (!secret) return res.status(404).json({ success: false, error: 'Secret not found' });
  try {
    const tables = await introspectDatabase({
      host: connector.host,
      port: connector.port,
      username: secret.username,
      password: secret.password,
      database: connector.database,
      dialect: connector.dialect
    });
    logAudit(req.user?.id, 'connector.introspect', { connectorId }, orgId);
    res.json({ success: true, tables });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
