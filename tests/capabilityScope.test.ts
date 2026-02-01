import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertCapabilityScope } = require('../server/middleware/capability.cjs');

const schemaContext = `TABLE: public.orders
columns:
- id (int)
- total (numeric)

TABLE: customers
columns:
- id (int)
- name (text)
`;

test('allows matching connector allowlist', () => {
  const req = { capability: { allowed_connector_ids: ['conn-1'], dataset_allowlist: [] } };
  assert.doesNotThrow(() => assertCapabilityScope(req, { connectorId: 'conn-1', schemaContext }));
});

test('blocks missing connector scope', () => {
  const req = { capability: { allowed_connector_ids: ['conn-1'], dataset_allowlist: [] } };
  assert.throws(() => assertCapabilityScope(req, { connectorId: undefined, schemaContext }));
});

test('blocks disallowed connector', () => {
  const req = { capability: { allowed_connector_ids: ['conn-1'], dataset_allowlist: [] } };
  assert.throws(() => assertCapabilityScope(req, { connectorId: 'conn-2', schemaContext }));
});

test('allows dataset allowlist by base table name', () => {
  const req = { capability: { allowed_connector_ids: [], dataset_allowlist: ['orders', 'customers'] } };
  assert.doesNotThrow(() => assertCapabilityScope(req, { connectorId: 'conn-1', schemaContext }));
});

test('blocks dataset not in allowlist', () => {
  const req = { capability: { allowed_connector_ids: [], dataset_allowlist: ['orders'] } };
  assert.throws(() => assertCapabilityScope(req, { connectorId: 'conn-1', schemaContext }));
});
