const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserProfile,
  createOrg,
  addMembership,
  getUserMemberships,
  getUserRoleForOrg
} = require('../db/sqliteStore.cjs');

const router = express.Router();

function signToken(user, memberships = []) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const orgIds = memberships.map(m => m.org_id);
  const orgId = orgIds[0] || null;
  const role = memberships.find(m => m.org_id === orgId)?.role || user.role || 'Viewer';
  return jwt.sign(
    { id: user.id, email: user.email, org_id: orgId, org_ids: orgIds, role },
    secret,
    { expiresIn: '30d' }
  );
}

router.post('/auth/register', async (req, res) => {
  const { email, password, name, company, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }
  const existing = getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Email already registered.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({
    id: `user_${Date.now()}`,
    email,
    name,
    company,
    role,
    passwordHash
  });
  const org = createOrg({ id: `org_${Date.now()}`, name: company || `${name || email}'s Org` });
  addMembership({ userId: user.id, orgId: org.id, role: 'Owner' });
  const memberships = getUserMemberships(user.id);
  const token = signToken(user, memberships);
  res.json({
    success: true,
    data: { user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role }, token }
  });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }
  const user = getUserByEmail(email);
  if (!user || !user.password_hash) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }
  const memberships = getUserMemberships(user.id);
  const token = signToken(user, memberships);
  res.json({
    success: true,
    data: { user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role }, token }
  });
});

router.get('/auth/me', (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  const memberships = getUserMemberships(userId);
  res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role } } });
});

router.patch('/auth/profile', (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  try {
    const user = updateUserProfile(userId, req.body || {});
    res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role } } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/auth/profile', (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  try {
    const user = updateUserProfile(userId, req.body || {});
    res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role } } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/auth/logout', (_req, res) => {
  res.json({ success: true });
});

module.exports = router;
