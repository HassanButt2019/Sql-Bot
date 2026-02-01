export interface SchemaProfileTable {
  name: string;
  sampleRows: Record<string, any>[];
  columnStats: Record<string, { nonNull: number; distinct: number; examples: any[]; inferredType?: string }>;
}

export interface SchemaProfile {
  tables: SchemaProfileTable[];
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function parseSchemaTables(schema: string): string[] {
  if (!schema) return [];
  const blocks = schema.split(/\n\s*\n/);
  const tables: string[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const tableLine = lines.find(line => line.startsWith('TABLE:'));
    if (!tableLine) continue;
    const name = tableLine.replace('TABLE:', '').trim();
    if (name) tables.push(name);
  }
  return tables;
}

function inferType(values: any[]): string {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'unknown';
  let numCount = 0;
  let dateCount = 0;
  for (const v of nonNull) {
    if (typeof v === 'number') {
      numCount += 1;
      continue;
    }
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed && !Number.isNaN(Number(trimmed))) {
        numCount += 1;
      }
      const asDate = Date.parse(trimmed);
      if (!Number.isNaN(asDate)) {
        dateCount += 1;
      }
    }
  }
  if (numCount / nonNull.length > 0.6) return 'number';
  if (dateCount / nonNull.length > 0.6) return 'date';
  return 'string';
}

const profileCache = new Map<string, Promise<SchemaProfile>>();

export async function buildSchemaProfile(
  schemaContext: string,
  localExecutor: (sql: string) => Promise<any[]>,
  options: { maxTables?: number; sampleRows?: number } = {}
): Promise<SchemaProfile> {
  const maxTables = options.maxTables ?? 4;
  const sampleRows = options.sampleRows ?? 5;
  const cacheKey = `${hashString(schemaContext)}:${maxTables}:${sampleRows}`;
  if (profileCache.has(cacheKey)) {
    return profileCache.get(cacheKey)!;
  }

  const task = (async () => {
    const tables = parseSchemaTables(schemaContext).slice(0, maxTables);
    const tableProfiles: SchemaProfileTable[] = [];
    for (const table of tables) {
      const safeName = table.replace(/"/g, '""');
      let rows: Record<string, any>[] = [];
      try {
        rows = await localExecutor(`SELECT * FROM "${safeName}" LIMIT ${sampleRows}`);
      } catch {
        try {
          rows = await localExecutor(`SELECT * FROM ${table} LIMIT ${sampleRows}`);
        } catch {
          rows = [];
        }
      }
      const columnStats: Record<string, { nonNull: number; distinct: number; examples: any[]; inferredType?: string }> = {};
      for (const row of rows || []) {
        for (const [key, value] of Object.entries(row || {})) {
          if (!columnStats[key]) {
            columnStats[key] = { nonNull: 0, distinct: 0, examples: [], inferredType: 'unknown' };
          }
          if (value !== null && value !== undefined && value !== '') {
            columnStats[key].nonNull += 1;
            if (columnStats[key].examples.length < 3 && !columnStats[key].examples.includes(value)) {
              columnStats[key].examples.push(value);
            }
          }
        }
      }
      for (const [key, stat] of Object.entries(columnStats)) {
        const values = rows.map(row => row?.[key]).filter(v => v !== undefined);
        const distinct = new Set(values.map(v => (typeof v === 'string' ? v.trim() : JSON.stringify(v)))).size;
        columnStats[key] = {
          ...stat,
          distinct,
          inferredType: inferType(values)
        };
      }
      tableProfiles.push({ name: table, sampleRows: rows || [], columnStats });
    }
    return { tables: tableProfiles };
  })();

  profileCache.set(cacheKey, task);
  return task;
}
