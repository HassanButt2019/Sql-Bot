function extractSchemaTables(schemaContext) {
  if (!schemaContext || typeof schemaContext !== 'string') return [];
  const blocks = schemaContext.split(/\n\s*\n/);
  const tables = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const tableLine = lines.find(line => line.startsWith('TABLE:'));
    if (!tableLine) continue;
    const name = tableLine.replace('TABLE:', '').trim();
    if (name) tables.push(name);
  }
  return tables;
}

module.exports = { extractSchemaTables };
