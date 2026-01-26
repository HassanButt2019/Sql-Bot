import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { enforceSqlGuardrails } = require('../server/utils/sqlGuardrails.cjs');

test('adds limit when missing', () => {
  const sql = enforceSqlGuardrails('SELECT * FROM users', { maxRows: 25 });
  assert.ok(/limit\s+25/i.test(sql));
});

test('keeps existing limit', () => {
  const sql = enforceSqlGuardrails('select * from users limit 5', { maxRows: 25 });
  const matches = sql.match(/limit\s+\d+/i) || [];
  assert.equal(matches[0].toLowerCase(), 'limit 5');
});

test('blocks non-select queries', () => {
  assert.throws(() => enforceSqlGuardrails('DELETE FROM users', { maxRows: 10 }));
});

test('blocks multiple statements', () => {
  assert.throws(() => enforceSqlGuardrails('SELECT 1; SELECT 2', { maxRows: 10 }));
});

test('allows with statements', () => {
  const sql = enforceSqlGuardrails('WITH t AS (SELECT 1) SELECT * FROM t', { maxRows: 10 });
  assert.ok(/limit\s+10/i.test(sql));
});

test('adds mysql execution time hint', () => {
  const sql = enforceSqlGuardrails('SELECT * FROM orders', { maxRows: 10, timeoutMs: 5000, dialect: 'mysql' });
  assert.ok(/MAX_EXECUTION_TIME\(5000\)/.test(sql));
});
