import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getPermissionsForRole, requirePermission } = require('../server/policies/rbac.cjs');

test('permissions include query run for Analyst', () => {
  const perms = getPermissionsForRole('Analyst');
  assert.ok(perms.includes('queries:run'));
});

test('requirePermission blocks missing permission', async () => {
  let statusCode = 200;
  const req = { auth: { role: 'Viewer' } };
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
  const guard = requirePermission('dashboards:update');
  guard(req, res, next);
  assert.equal(statusCode, 403);
});
