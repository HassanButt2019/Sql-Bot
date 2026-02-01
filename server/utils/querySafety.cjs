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

function containsForbiddenKeyword(sql) {
  const normalized = normalizeSql(sql).toLowerCase();
  if (!normalized) return false;
  const forbidden = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'grant', 'revoke', 'commit', 'rollback', 'call', 'exec', 'merge',
    'replace', 'vacuum', 'analyze'
  ];
  return forbidden.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(normalized));
}

function isReadOnlyQuery(sql) {
  const normalized = normalizeSql(sql).toLowerCase();
  if (!normalized) return false;
  if (hasMultipleStatements(sql)) return false;
  if (containsForbiddenKeyword(sql)) return false;
  return (
    normalized.startsWith('select') ||
    normalized.startsWith('with') ||
    normalized.startsWith('show') ||
    normalized.startsWith('describe') ||
    normalized.startsWith('explain')
  );
}

module.exports = {
  isReadOnlyQuery
};
