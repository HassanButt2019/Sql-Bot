const { parseConnectionString } = require('./connectionString.cjs');
const { introspectPostgres, testPostgresConnection, executePostgresQuery } = require('./postgres.cjs');
const { introspectMySQL, testMySQLConnection, executeMySQLQuery } = require('./mysql.cjs');
const { isReadOnlyQuery } = require('../utils/querySafety.cjs');
const { enforceSqlGuardrails } = require('../utils/sqlGuardrails.cjs');

async function testConnection(config) {
  if (config.dialect === 'postgresql') {
    await testPostgresConnection(config);
    return;
  }
  if (config.dialect === 'mysql') {
    await testMySQLConnection(config);
    return;
  }
  throw new Error(`Dialect ${config.dialect} is not yet supported`);
}

async function introspectDatabase(config) {
  if (config.dialect === 'postgresql') {
    return introspectPostgres(config);
  }
  if (config.dialect === 'mysql') {
    return introspectMySQL(config);
  }
  throw new Error(`Dialect ${config.dialect} is not yet supported`);
}

async function executeQuery(config, query) {
  if (!isReadOnlyQuery(query)) {
    throw new Error('Read-only mode: only SELECT queries are allowed.');
  }
  const timeoutMs = config.statement_timeout ?? parseInt(process.env.SQL_STATEMENT_TIMEOUT_MS || '15000', 10);
  const maxRows = parseInt(process.env.SQL_MAX_ROWS || '1000', 10);
  const guarded = enforceSqlGuardrails(query, { maxRows, timeoutMs, dialect: config.dialect });
  if (config.dialect === 'postgresql') {
    return executePostgresQuery({ ...config, statement_timeout: timeoutMs }, guarded);
  }
  if (config.dialect === 'mysql') {
    return executeMySQLQuery(config, guarded);
  }
  throw new Error(`Unsupported dialect: ${config.dialect}`);
}

module.exports = {
  parseConnectionString,
  testConnection,
  introspectDatabase,
  executeQuery
};
