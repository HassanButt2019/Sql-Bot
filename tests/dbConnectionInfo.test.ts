import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDbConnectionInfo, type PasswordStore } from '../services/dbConnectionInfo';
import type { DbConnection } from '../types';

const baseConnection: DbConnection = {
  id: 'conn-1',
  name: 'Primary DB',
  host: 'localhost',
  port: '5432',
  username: 'admin',
  database: 'analytics',
  dialect: 'postgresql',
  tables: [],
  isActive: true,
  status: 'connected',
  connectionString: 'postgresql://admin@localhost:5432/analytics',
  useConnectionString: true
};

test('buildDbConnectionInfo returns null when no connection', () => {
  assert.equal(buildDbConnectionInfo(null), null);
});

test('buildDbConnectionInfo uses password store and preserves flags', () => {
  const passwordStore: PasswordStore = {
    getPassword() {
      return 'secret';
    }
  };

  const info = buildDbConnectionInfo(baseConnection, passwordStore);
  assert.equal(info?.password, 'secret');
  assert.equal(info?.connectionString, baseConnection.connectionString);
  assert.equal(info?.useConnectionString, true);
  assert.equal(info?.dialect, 'postgresql');
});
