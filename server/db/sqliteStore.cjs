const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

let db;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    initSchema();
  }
  return db;
}

function initSchema() {
  const conn = db;
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      plan_id TEXT,
      password_hash TEXT,
      company TEXT,
      role TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      org_id TEXT,
      role TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT,
      monthly_query_limit INTEGER,
      monthly_dashboard_limit INTEGER,
      monthly_upload_limit INTEGER,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      user_id TEXT,
      metric TEXT,
      count INTEGER,
      period TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      user_id TEXT,
      action TEXT,
      details TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      user_id TEXT,
      event_type TEXT,
      success INTEGER,
      meta TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      kind TEXT,
      ciphertext TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      name TEXT,
      dialect TEXT,
      host TEXT,
      port TEXT,
      database TEXT,
      secret_id TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS billing_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      user_id TEXT,
      stripe_customer_id TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      user_id TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan_id TEXT,
      status TEXT,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER,
      price_id TEXT,
      interval TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      user_id TEXT,
      stripe_invoice_id TEXT,
      stripe_subscription_id TEXT,
      amount_paid INTEGER,
      currency TEXT,
      status TEXT,
      paid INTEGER,
      created_at INTEGER
    );
  `);
  ensureUserColumns();
  ensureOrgColumns();
  ensurePlanDefaults();
}

function ensureUserColumns() {
  const conn = db;
  const columns = conn.prepare("PRAGMA table_info('users')").all().map(row => row.name);
  const addColumn = (name, type) => {
    if (!columns.includes(name)) {
      conn.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    }
  };
  addColumn('password_hash', 'TEXT');
  addColumn('company', 'TEXT');
  addColumn('role', 'TEXT');
  addColumn('updated_at', 'INTEGER');
}

function ensureOrgColumns() {
  const conn = db;
  const addIfMissing = (table, name, type) => {
    const columns = conn.prepare(`PRAGMA table_info('${table}')`).all().map(row => row.name);
    if (!columns.includes(name)) {
      conn.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  };
  addIfMissing('usage', 'org_id', 'TEXT');
  addIfMissing('audit_logs', 'org_id', 'TEXT');
  addIfMissing('events', 'org_id', 'TEXT');
}

function ensurePlanDefaults() {
  const conn = getDb();
  const exists = conn.prepare('SELECT id FROM plans WHERE id = ?').get('free');
  if (!exists) {
    const stmt = conn.prepare('INSERT INTO plans (id, name, monthly_query_limit, monthly_dashboard_limit, monthly_upload_limit, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const now = Date.now();
    stmt.run('free', 'Free', 200, 10, 5, now);
    stmt.run('pro', 'Pro', 2000, 100, 50, now);
    stmt.run('team', 'Team', 10000, 1000, 500, now);
  }
}

function ensureUser(userId) {
  const conn = getDb();
  let user = conn.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const now = Date.now();
    conn.prepare('INSERT INTO users (id, email, name, plan_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, null, null, 'free', now, now);
    user = conn.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }
  return user;
}

function createUser({ id, email, name, passwordHash, company, role, planId = 'free' }) {
  const conn = getDb();
  const now = Date.now();
  conn.prepare('INSERT INTO users (id, email, name, password_hash, company, role, plan_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, name || null, passwordHash, company || null, role || null, planId, now, now);
  return conn.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createOrg({ id, name }) {
  const conn = getDb();
  const now = Date.now();
  conn.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)')
    .run(id, name || null, now);
  return conn.prepare('SELECT * FROM orgs WHERE id = ?').get(id);
}

function addMembership({ userId, orgId, role }) {
  const conn = getDb();
  const now = Date.now();
  conn.prepare('INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, orgId, role, now);
  return conn.prepare('SELECT * FROM memberships WHERE user_id = ? AND org_id = ?').get(userId, orgId);
}

function getUserMemberships(userId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM memberships WHERE user_id = ?').all(userId);
}

function getUserRoleForOrg(userId, orgId) {
  const conn = getDb();
  const row = conn.prepare('SELECT role FROM memberships WHERE user_id = ? AND org_id = ?').get(userId, orgId);
  return row?.role || null;
}

function getUserByEmail(email) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(userId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function updateUserProfile(userId, updates = {}) {
  const conn = getDb();
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');
  const next = {
    name: updates.name ?? user.name,
    company: updates.company ?? user.company,
    role: updates.role ?? user.role,
    updated_at: Date.now()
  };
  conn.prepare('UPDATE users SET name = ?, company = ?, role = ?, updated_at = ? WHERE id = ?')
    .run(next.name, next.company, next.role, next.updated_at, userId);
  return getUserById(userId);
}

function updateUserPlan(userId, planId) {
  const conn = getDb();
  conn.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?')
    .run(planId, Date.now(), userId);
  return getUserById(userId);
}

function listUsersByOrg(orgId) {
  const conn = getDb();
  return conn.prepare('SELECT user_id as id FROM memberships WHERE org_id = ?').all(orgId);
}

function updateOrgPlan(orgId, planId) {
  const users = listUsersByOrg(orgId);
  for (const user of users) {
    updateUserPlan(user.id, planId);
  }
}

function getPlanForUser(userId) {
  const conn = getDb();
  const user = ensureUser(userId);
  return conn.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id);
}

function getPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getUsage(userId, metric, period = getPeriodKey(), orgId = null) {
  const conn = getDb();
  const row = conn.prepare('SELECT * FROM usage WHERE user_id = ? AND metric = ? AND period = ? AND org_id IS ?')
    .get(userId, metric, period, orgId);
  return row ? row.count : 0;
}

function incrementUsage(userId, metric, amount = 1, period = getPeriodKey(), orgId = null) {
  const conn = getDb();
  const existing = conn.prepare('SELECT id, count FROM usage WHERE user_id = ? AND metric = ? AND period = ? AND org_id IS ?')
    .get(userId, metric, period, orgId);
  const now = Date.now();
  if (existing) {
    conn.prepare('UPDATE usage SET count = ?, updated_at = ? WHERE id = ?')
      .run(existing.count + amount, now, existing.id);
    return existing.count + amount;
  }
  conn.prepare('INSERT INTO usage (org_id, user_id, metric, count, period, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(orgId, userId, metric, amount, period, now);
  return amount;
}

function checkLimit(userId, metric, limit, orgId = null) {
  if (limit === null || limit === undefined) return { allowed: true, remaining: null };
  const used = getUsage(userId, metric, getPeriodKey(), orgId);
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, remaining };
}

function logAudit(userId, action, details = {}, orgId = null) {
  const conn = getDb();
  conn.prepare('INSERT INTO audit_logs (org_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(orgId, userId, action, JSON.stringify(details || {}), Date.now());
}

function logEvent(userId, eventType, success, meta = {}, orgId = null) {
  const conn = getDb();
  conn.prepare('INSERT INTO events (org_id, user_id, event_type, success, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(orgId, userId, eventType, success ? 1 : 0, JSON.stringify(meta || {}), Date.now());
}

function listAuditLogs(userId, limit = 200, orgId = null) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM audit_logs WHERE user_id = ? AND org_id IS ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, orgId, limit);
}

function getAnalyticsSummary(userId, orgId = null) {
  const conn = getDb();
  const total = conn.prepare('SELECT COUNT(*) as count FROM events WHERE user_id = ? AND org_id IS ?').get(userId, orgId);
  const failures = conn.prepare('SELECT COUNT(*) as count FROM events WHERE user_id = ? AND success = 0 AND org_id IS ?').get(userId, orgId);
  const byType = conn.prepare('SELECT event_type, COUNT(*) as count FROM events WHERE user_id = ? AND org_id IS ? GROUP BY event_type ORDER BY count DESC')
    .all(userId, orgId);
  return {
    totalEvents: total?.count || 0,
    failureEvents: failures?.count || 0,
    byType
  };
}

function listConnectorsByOrg(orgId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM connectors WHERE org_id = ? ORDER BY created_at DESC').all(orgId);
}

function getConnectorById(connectorId, orgId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM connectors WHERE id = ? AND org_id = ?').get(connectorId, orgId);
}

function createConnector(connector) {
  const conn = getDb();
  const now = Date.now();
  conn.prepare('INSERT INTO connectors (id, org_id, name, dialect, host, port, database, secret_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      connector.id,
      connector.org_id,
      connector.name,
      connector.dialect,
      connector.host,
      connector.port,
      connector.database,
      connector.secret_id,
      now,
      now
    );
  return getConnectorById(connector.id, connector.org_id);
}

function updateConnector(connectorId, orgId, updates = {}) {
  const conn = getDb();
  const existing = getConnectorById(connectorId, orgId);
  if (!existing) throw new Error('Connector not found');
  const next = {
    name: updates.name ?? existing.name,
    dialect: updates.dialect ?? existing.dialect,
    host: updates.host ?? existing.host,
    port: updates.port ?? existing.port,
    database: updates.database ?? existing.database,
    secret_id: updates.secret_id ?? existing.secret_id,
    updated_at: Date.now()
  };
  conn.prepare('UPDATE connectors SET name = ?, dialect = ?, host = ?, port = ?, database = ?, secret_id = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .run(next.name, next.dialect, next.host, next.port, next.database, next.secret_id, next.updated_at, connectorId, orgId);
  return getConnectorById(connectorId, orgId);
}

function getBillingCustomerByOrg(orgId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM billing_customers WHERE org_id = ? ORDER BY created_at DESC LIMIT 1').get(orgId);
}

function upsertBillingCustomer({ orgId, userId, stripeCustomerId }) {
  const conn = getDb();
  const existing = getBillingCustomerByOrg(orgId);
  if (existing) {
    conn.prepare('UPDATE billing_customers SET stripe_customer_id = ? WHERE id = ?')
      .run(stripeCustomerId, existing.id);
    return getBillingCustomerByOrg(orgId);
  }
  conn.prepare('INSERT INTO billing_customers (org_id, user_id, stripe_customer_id, created_at) VALUES (?, ?, ?, ?)')
    .run(orgId, userId, stripeCustomerId, Date.now());
  return getBillingCustomerByOrg(orgId);
}

function getSubscriptionByOrg(orgId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM subscriptions WHERE org_id = ? ORDER BY updated_at DESC LIMIT 1').get(orgId);
}

function getSubscriptionByStripeId(stripeSubscriptionId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubscriptionId);
}

function getBillingCustomerByStripeId(stripeCustomerId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM billing_customers WHERE stripe_customer_id = ?').get(stripeCustomerId);
}

function upsertSubscription(payload) {
  const conn = getDb();
  const existing = getSubscriptionByOrg(payload.org_id);
  const now = Date.now();
  if (existing) {
    conn.prepare(`UPDATE subscriptions
      SET stripe_customer_id = ?, stripe_subscription_id = ?, plan_id = ?, status = ?, current_period_end = ?, cancel_at_period_end = ?, price_id = ?, interval = ?, updated_at = ?
      WHERE id = ?`)
      .run(
        payload.stripe_customer_id,
        payload.stripe_subscription_id,
        payload.plan_id,
        payload.status,
        payload.current_period_end,
        payload.cancel_at_period_end ? 1 : 0,
        payload.price_id,
        payload.interval,
        now,
        existing.id
      );
    return getSubscriptionByOrg(payload.org_id);
  }
  conn.prepare(`INSERT INTO subscriptions
    (org_id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, price_id, interval, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      payload.org_id,
      payload.user_id,
      payload.stripe_customer_id,
      payload.stripe_subscription_id,
      payload.plan_id,
      payload.status,
      payload.current_period_end,
      payload.cancel_at_period_end ? 1 : 0,
      payload.price_id,
      payload.interval,
      now
    );
  return getSubscriptionByOrg(payload.org_id);
}

function recordInvoice(payload) {
  const conn = getDb();
  conn.prepare(`INSERT INTO invoices
    (org_id, user_id, stripe_invoice_id, stripe_subscription_id, amount_paid, currency, status, paid, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      payload.org_id,
      payload.user_id,
      payload.stripe_invoice_id,
      payload.stripe_subscription_id,
      payload.amount_paid,
      payload.currency,
      payload.status,
      payload.paid ? 1 : 0,
      Date.now()
    );
}

function deleteConnector(connectorId, orgId) {
  const conn = getDb();
  conn.prepare('DELETE FROM connectors WHERE id = ? AND org_id = ?').run(connectorId, orgId);
}

function updatePlan(planId, updates = {}) {
  const conn = getDb();
  const plan = conn.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) throw new Error('Plan not found');
  const next = {
    monthly_query_limit: updates.monthly_query_limit ?? plan.monthly_query_limit,
    monthly_dashboard_limit: updates.monthly_dashboard_limit ?? plan.monthly_dashboard_limit,
    monthly_upload_limit: updates.monthly_upload_limit ?? plan.monthly_upload_limit
  };
  conn.prepare('UPDATE plans SET monthly_query_limit = ?, monthly_dashboard_limit = ?, monthly_upload_limit = ? WHERE id = ?')
    .run(next.monthly_query_limit, next.monthly_dashboard_limit, next.monthly_upload_limit, planId);
  return conn.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
}

module.exports = {
  getDb,
  ensureUser,
  createUser,
  getUserByEmail,
  getUserById,
  updateUserProfile,
  updateUserPlan,
  updateOrgPlan,
  createOrg,
  addMembership,
  getUserMemberships,
  getUserRoleForOrg,
  getPlanForUser,
  getUsage,
  incrementUsage,
  checkLimit,
  logAudit,
  logEvent,
  listAuditLogs,
  getAnalyticsSummary,
  listConnectorsByOrg,
  getConnectorById,
  createConnector,
  updateConnector,
  deleteConnector,
  updatePlan,
  getBillingCustomerByOrg,
  getBillingCustomerByStripeId,
  upsertBillingCustomer,
  getSubscriptionByOrg,
  getSubscriptionByStripeId,
  upsertSubscription,
  recordInvoice
};
