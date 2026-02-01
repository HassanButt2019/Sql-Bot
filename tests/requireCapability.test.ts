import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { issueCapabilityToken } = require('../server/ai/capabilities.cjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requireCapability } = require('../server/middleware/capability.cjs');

process.env.CAPABILITY_SECRET = 'test-capability-secret';

test('requireCapability blocks when token missing', () => {
  let statusCode = 200;
  const req = { header: () => null, auth: { tenant: { orgId: 'org-1' } } };
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };
  const next = () => {
    statusCode = 200;
  };
  const guard = requireCapability('dashboard.generate');
  guard(req, res, next);
  assert.equal(statusCode, 403);
});

test('requireCapability allows valid token', () => {
  const token = issueCapabilityToken({ org_id: 'org-1', allowed_actions: ['dashboard.generate'] }, 60);
  let statusCode = 200;
  const req = {
    header: () => token,
    auth: { tenant: { orgId: 'org-1' } }
  };
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };
  const next = () => {
    statusCode = 200;
  };
  const guard = requireCapability('dashboard.generate');
  guard(req, res, next);
  assert.equal(statusCode, 200);
});
