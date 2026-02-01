const test = require('node:test');
const assert = require('node:assert/strict');
const { parseConnectionString } = require('./connectionString');

test('parseConnectionString supports jdbc format and ssl params', () => {
  const result = parseConnectionString('jdbc:postgresql://db.example.com:5432/mydb?sslmode=require', 'postgresql');
  assert.equal(result.host, 'db.example.com');
  assert.equal(result.port, '5432');
  assert.equal(result.database, 'mydb');
  assert.equal(result.ssl, true);
});

test('parseConnectionString supports user/pass url format', () => {
  const result = parseConnectionString('postgresql://user:pass@localhost:5432/app', 'postgresql');
  assert.equal(result.username, 'user');
  assert.equal(result.password, 'pass');
  assert.equal(result.database, 'app');
});
