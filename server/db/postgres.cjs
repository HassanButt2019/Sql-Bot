const { Pool } = require('pg');

function buildPostgresPoolConfig(config) {
  const poolConfig = {
    host: config.host,
    port: parseInt(config.port) || 5432,
    user: String(config.username),
    password: String(config.password),
    database: config.database,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 30000,
    idle_in_transaction_session_timeout: config.idle_in_transaction_session_timeout ?? 30000,
    statement_timeout: config.statement_timeout ?? 30000,
  };

  if (config.ssl || config.host.includes('azure.com') || config.host.includes('amazonaws.com') || config.host.includes('cloud.google.com')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  return poolConfig;
}

async function introspectPostgres(config) {
  if (!config.username || !config.password) {
    throw new Error('Username and password are required. Please fill in the User and Password fields.');
  }

  console.log('Connecting to PostgreSQL:', { host: config.host, port: config.port, database: config.database, ssl: config.ssl, user: config.username });

  const pool = new Pool(buildPostgresPoolConfig(config));

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('Connected successfully to PostgreSQL!');

    const tablesQuery = `
      SELECT 
        t.table_name,
        array_agg(
          c.column_name || ' (' || c.data_type || 
          CASE WHEN c.is_nullable = 'NO' THEN ', NOT NULL' ELSE '' END ||
          CASE WHEN c.column_default IS NOT NULL THEN ', DEFAULT' ELSE '' END ||
          ')'
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;

    const result = await client.query(tablesQuery);
    client.release();
    await pool.end();

    console.log(`Found ${result.rows.length} tables`);
    console.log('--- FULL DATABASE SCHEMA ---');
    result.rows.forEach(row => {
      console.log(`Table: ${row.table_name}`);
      row.columns.forEach(col => console.log(`  ${col}`));
    });
    console.log('--- END OF SCHEMA ---');

    return result.rows.map(row => ({
      name: row.table_name,
      schema: row.columns.join(', '),
      selected: false
    }));
  } catch (error) {
    console.error('PostgreSQL connection error:', error.message);
    try { await pool.end(); } catch (e) {}
    throw error;
  }
}

async function testPostgresConnection(config) {
  const pool = new Pool({
    host: config.host,
    port: parseInt(config.port) || 5432,
    user: config.username,
    password: config.password,
    database: config.database,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  await pool.end();
}

async function executePostgresQuery(config, query) {
  const pool = new Pool(buildPostgresPoolConfig(config));
  const client = await pool.connect();
  const queryResult = await client.query(query);
  client.release();
  await pool.end();
  return queryResult.rows;
}

module.exports = {
  introspectPostgres,
  testPostgresConnection,
  executePostgresQuery
};
