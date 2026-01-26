async function selfHealingQuery(executeQuery, config, sql, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;
  let result = [];
  let adjustedSql = sql;

  while (attempt <= maxRetries) {
    try {
      result = await executeQuery(config, adjustedSql);
      if (result && result.length > 0) {
        const hasNaN = result.some(row => Object.values(row).some(v => typeof v === 'number' && (isNaN(v) || v === null)));
        if (!hasNaN) return result;
      }
      lastError = 'NaN or null detected';
    } catch (err) {
      lastError = err.message;
    }
    adjustedSql = adjustedSql.replace(/(SUM|AVG|COUNT|MIN|MAX)\(([^)]+)\)/gi, '$1(COALESCE($2,0))')
                             .replace(/\/(\s*\w+)/g, '/NULLIF($1,0)');
    attempt++;
  }
  throw new Error(`Self-healing failed: ${lastError}`);
}

module.exports = {
  selfHealingQuery
};
