import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { issueCapabilityToken, verifyCapabilityToken } = require('../server/ai/capabilities.cjs');

process.env.CAPABILITY_SECRET = 'test-capability-secret';

test('capability token validates action and org', () => {
  const token = issueCapabilityToken({ org_id: 'org-1', allowed_actions: ['dashboard.generate'] }, 60);
  const decoded = verifyCapabilityToken(token, { org_id: 'org-1', action: 'dashboard.generate' });
  assert.equal(decoded.org_id, 'org-1');
});

test('capability token rejects wrong org', () => {
  const token = issueCapabilityToken({ org_id: 'org-1', allowed_actions: ['dashboard.generate'] }, 60);
  assert.throws(() => verifyCapabilityToken(token, { org_id: 'org-2', action: 'dashboard.generate' }));
});

test('capability token rejects missing action', () => {
  const token = issueCapabilityToken({ org_id: 'org-1', allowed_actions: ['dashboard.update'] }, 60);
  assert.throws(() => verifyCapabilityToken(token, { org_id: 'org-1', action: 'dashboard.generate' }));
});
