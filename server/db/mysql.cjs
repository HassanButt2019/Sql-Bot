const mysql = require('mysql2/promise');

async function introspectMySQL(config) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: parseInt(config.port) || 3306,
    user: config.username,
    password: config.password,
    database: config.database,
    connectTimeout: 10000,
  });

  try {
    const [tables] = await connection.execute(`
      SELECT 
        TABLE_NAME as table_name,
        GROUP_CONCAT(
          CONCAT(COLUMN_NAME, ' (', DATA_TYPE, 
          CASE WHEN IS_NULLABLE = 'NO' THEN ', NOT NULL' ELSE '' END,
          CASE WHEN COLUMN_DEFAULT IS NOT NULL THEN ', DEFAULT' ELSE '' END,
          ')')
          SEPARATOR ', '
        ) as columns
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ?
      GROUP BY TABLE_NAME
      ORDER BY TABLE_NAME
    `, [config.database]);

    await connection.end();

    return tables.map(row => ({
      name: row.table_name,
      schema: row.columns,
      selected: false
    }));
  } catch (error) {
    await connection.end();
    throw error;
  }
}

async function testMySQLConnection(config) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: parseInt(config.port) || 3306,
    user: config.username,
    password: config.password,
    database: config.database,
    connectTimeout: 10000,
  });
  await connection.execute('SELECT 1');
  await connection.end();
}

async function executeMySQLQuery(config, query) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: parseInt(config.port) || 3306,
    user: config.username,
    password: config.password,
    database: config.database,
    connectTimeout: 30000,
  });
  const [rows] = await connection.execute(query);
  await connection.end();
  return rows;
}

module.exports = {
  introspectMySQL,
  testMySQLConnection,
  executeMySQLQuery
};
