import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveTenant, normalizeOrgIds } = require('../server/auth/tenantContext.cjs');

test('normalizeOrgIds collects org_id and org_ids', () => {
  const ids = normalizeOrgIds({ org_id: 'org-1', org_ids: ['org-2'] });
  assert.deepEqual(ids.sort(), ['org-1', 'org-2']);
});

test('resolveTenant uses header when valid', () => {
  const req = { header: (key: string) => (key === 'x-org-id' ? 'org-2' : null) };
  const tenant = resolveTenant(req, { org_ids: ['org-1', 'org-2'] });
  assert.equal(tenant.orgId, 'org-2');
});

test('resolveTenant throws on invalid header', () => {
  const req = { header: (key: string) => (key === 'x-org-id' ? 'org-9' : null) };
  assert.throws(() => resolveTenant(req, { org_ids: ['org-1'] }));
});
