const DEFAULT_MAX_ROWS = 1000;

function normalizeSql(sql) {
  if (!sql || typeof sql !== 'string') return '';
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

function hasMultipleStatements(sql) {
  const normalized = normalizeSql(sql);
  if (!normalized) return false;
  const parts = normalized.split(';').map(part => part.trim()).filter(Boolean);
  return parts.length > 1;
}

function isSelectOnly(sql) {
  const normalized = normalizeSql(sql).toLowerCase();
  if (!normalized) return false;
  const forbidden = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'grant', 'revoke', 'commit', 'rollback', 'call', 'exec', 'merge',
    'replace', 'vacuum', 'analyze'
  ];
  if (forbidden.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(normalized))) return false;
  const firstToken = normalized.match(/^\s*(\w+)/)?.[1];
  return firstToken === 'select' || firstToken === 'with' || firstToken === 'show' || firstToken === 'describe' || firstToken === 'explain';
}

function hasLimit(sql) {
  return /\blimit\s+\d+/i.test(sql);
}

function addLimit(sql, maxRows) {
  if (hasLimit(sql)) return sql;
  return `${sql.replace(/;\s*$/g, '')} LIMIT ${maxRows}`;
}

function addMySqlMaxExecutionTimeHint(sql, timeoutMs) {
  if (!timeoutMs) return sql;
  const normalized = normalizeSql(sql);
  if (!normalized.toLowerCase().startsWith('select')) return sql;
  return `/*+ MAX_EXECUTION_TIME(${Math.max(1, Math.floor(timeoutMs))}) */ ${sql}`;
}

function enforceSqlGuardrails(sql, options = {}) {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const timeoutMs = options.timeoutMs;
  const dialect = options.dialect || '';
  const normalized = normalizeSql(sql);
  if (!normalized) throw new Error('SQL is empty.');
  if (hasMultipleStatements(normalized)) throw new Error('SQL must be a single statement.');
  if (!isSelectOnly(normalized)) throw new Error('Only read-only SELECT queries are allowed.');

  let guarded = addLimit(normalized, maxRows);
  if (dialect === 'mysql') {
    guarded = addMySqlMaxExecutionTimeHint(guarded, timeoutMs);
  }
  return guarded;
}

module.exports = {
  enforceSqlGuardrails
};
