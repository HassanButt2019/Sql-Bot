function parseConnectionString(connectionString, dialect) {
  try {
    let urlToParse = connectionString.trim();

    if (urlToParse.toLowerCase().startsWith('jdbc:')) {
      urlToParse = urlToParse.substring(5);
    }

    const url = new URL(urlToParse);

    let database = url.pathname.slice(1);
    if (database.includes('?')) {
      database = database.split('?')[0];
    }

    const searchParams = new URLSearchParams(url.search);
    const sslMode = searchParams.get('sslmode') || searchParams.get('ssl');
    const requireSSL = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || sslMode === 'true';

    return {
      host: url.hostname,
      port: url.port || (dialect === 'postgresql' ? '5432' : dialect === 'mysql' ? '3306' : '1433'),
      username: url.username ? decodeURIComponent(url.username) : null,
      password: url.password ? decodeURIComponent(url.password) : null,
      database,
      dialect,
      ssl: requireSSL
    };
  } catch (error) {
    const jdbcRegex = /^(?:jdbc:)?(\w+):\/\/([^:\/]+)(?::(\d+))?\/([^\?]+)(?:\?(.*))?$/i;
    const match = connectionString.match(jdbcRegex);

    if (match) {
      const [, , host, port, database, queryString] = match;
      const params = new URLSearchParams(queryString || '');
      const sslMode = params.get('sslmode') || params.get('ssl');
      const requireSSL = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || sslMode === 'true';

      return {
        host,
        port: port || (dialect === 'postgresql' ? '5432' : dialect === 'mysql' ? '3306' : '1433'),
        username: null,
        password: null,
        database,
        dialect,
        ssl: requireSSL
      };
    }

    throw new Error('Invalid connection string format. Expected format: jdbc:postgresql://host:port/database or postgresql://user:password@host:port/database');
  }
}

module.exports = {
  parseConnectionString
};
