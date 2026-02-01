import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';

type DuckDbConnection = duckdb.AsyncDuckDBConnection;

let dbInstance: duckdb.AsyncDuckDB | null = null;
let dbConnection: DuckDbConnection | null = null;
let dbWorker: Worker | null = null;
let lastRegisteredSheets: { tableName: string; columns: { name: string; included: boolean }[]; data: Record<string, any>[] }[] = [];

const MAX_IDENTIFIER_LENGTH = 63;

const normalizeIdentifier = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'column';
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
  if (!normalized) return 'column';
  if (/^[0-9]/.test(normalized)) return `col_${normalized}`;
  return normalized.slice(0, MAX_IDENTIFIER_LENGTH);
};

export const sanitizeIdentifier = (value: string) => normalizeIdentifier(value);

export const ensureUniqueIdentifiers = (values: string[]) => {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const base = normalizeIdentifier(value);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return base;
    const suffix = `_${count + 1}`;
    return (base + suffix).slice(0, MAX_IDENTIFIER_LENGTH);
  });
};

const toCsvValue = (value: any) => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const toCsv = (columns: string[], rows: Record<string, any>[]) => {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((col) => toCsvValue(row[col])).join(',')).join('\n');
  return `${header}\n${body}`;
};

const getDuckDb = async () => {
  if (dbInstance && dbConnection) {
    return { db: dbInstance, conn: dbConnection };
  }

  const bundle = await duckdb.selectBundle({
    mvp: {
      mainModule: duckdbWasm,
      mainWorker: duckdbWorker
    }
  });
  const worker = new Worker(bundle.mainWorker!, { type: 'module' });
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conn = await db.connect();
  dbInstance = db;
  dbConnection = conn;
  dbWorker = worker;
  return { db, conn };
};

const arrowTableToObjects = (table: any) => {
  if (!table) return [];
  if (typeof table.toArray !== 'function') return [];
  const rows = table.toArray();
  return rows.map((row: any) => {
    if (row && typeof row.toJSON === 'function') {
      return row.toJSON();
    }
    if (row && typeof row.toObject === 'function') {
      return row.toObject();
    }
    return row;
  });
};

export const registerExcelSheets = async (
  sheets: { tableName: string; columns: { name: string; included: boolean }[]; data: Record<string, any>[] }[]
) => {
  const { db, conn } = await getDuckDb();
  lastRegisteredSheets = sheets.map(sheet => ({
    tableName: sheet.tableName,
    columns: sheet.columns,
    data: sheet.data
  }));

  for (const sheet of sheets) {
    const activeColumns = sheet.columns.filter((col) => col.included).map((col) => col.name);
    if (activeColumns.length === 0) {
      continue;
    }
    const csv = toCsv(activeColumns, sheet.data);
    const fileName = `${sheet.tableName}.csv`;
    await db.registerFileBuffer(fileName, new TextEncoder().encode(csv));
    await conn.query(
      `CREATE OR REPLACE TABLE "${sheet.tableName}" AS SELECT * FROM read_csv_auto('${fileName}', HEADER=true)`
    );
  }
};

const resetDuckDb = async () => {
  if (dbWorker) {
    dbWorker.terminate();
  }
  dbInstance = null;
  dbConnection = null;
  dbWorker = null;
  if (lastRegisteredSheets.length > 0) {
    await registerExcelSheets(lastRegisteredSheets);
  }
};

export const executeDuckDbQuery = async (sql: string) => {
  const normalized = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .toLowerCase();
  const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'merge', 'replace'];
  if (forbidden.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(normalized))) {
    throw new Error('Read-only mode: only SELECT queries are allowed.');
  }
  if (!(normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('show') || normalized.startsWith('describe') || normalized.startsWith('explain'))) {
    throw new Error('Read-only mode: only SELECT queries are allowed.');
  }
  if (!/\blimit\s+\d+/i.test(sql)) {
    sql = `${sql.replace(/;\s*$/g, '')} LIMIT 1000`;
  }
  const { conn } = await getDuckDb();
  try {
    const result = await conn.query(sql);
    return arrowTableToObjects(result);
  } catch (err: any) {
    const message = err?.message || '';
    if (message.includes('_setThrew')) {
      await resetDuckDb();
      const { conn: retryConn } = await getDuckDb();
      const result = await retryConn.query(sql);
      return arrowTableToObjects(result);
    }
    throw err;
  }
};

export const getDuckDbTableSchema = async (tableName: string) => {
  const { conn } = await getDuckDb();
  const result = await conn.query(`PRAGMA table_info('${tableName}')`);
  const rows = arrowTableToObjects(result);
  return rows.map((row: any) => ({
    name: row.name,
    type: row.type
  }));
};

export const limitChartData = (chartData: any[], chartConfig: any) => {
  if (!Array.isArray(chartData) || chartData.length === 0 || !chartConfig) return chartData;

  const type = chartConfig.type;
  const yAxis = chartConfig.yAxis;

  const isCategorical = ['bar', 'pie', 'radar', 'composed'].includes(type);
  const isSeries = ['line', 'area'].includes(type);

  if (isCategorical && chartData.length > 12) {
    const sorted = [...chartData].sort((a, b) => {
      const aVal = Number(a?.[yAxis]) || 0;
      const bVal = Number(b?.[yAxis]) || 0;
      return bVal - aVal;
    });
    return sorted.slice(0, 12);
  }

  if (isSeries && chartData.length > 24) {
    const step = Math.ceil(chartData.length / 24);
    return chartData.filter((_, idx) => idx % step === 0);
  }

  return chartData;
};

export const coerceNumericAxis = (rows: any[], yAxis?: string) => {
  if (!Array.isArray(rows) || rows.length === 0 || !yAxis) return rows;
  return rows.map((row) => {
    const value = row?.[yAxis];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
        return { ...row, [yAxis]: Number(trimmed) };
      }
    }
    return row;
  });
};

const looksCategorical = (values: any[]) => {
  if (values.length === 0) return true;
  const unique = new Set(values.map(v => String(v ?? '').trim())).size;
  const sample = values.slice(0, 8);
  const dateLike = sample.filter(v => {
    const d = new Date(String(v));
    return !isNaN(d.getTime());
  }).length;
  return unique <= Math.max(6, Math.floor(values.length * 0.6)) || dateLike < Math.floor(sample.length / 2);
};

export const normalizeChartType = (rows: any[], chartConfig: any) => {
  if (!chartConfig || !Array.isArray(rows) || rows.length === 0) return chartConfig;
  const xAxis = chartConfig.xAxis;
  const type = chartConfig.type;
  if (!xAxis) return chartConfig;
  const values = rows.slice(0, 20).map(row => row?.[xAxis]);
  const isCategorical = looksCategorical(values);
  const isIdLike = typeof xAxis === 'string' && /(id|code|name|client|project)/i.test(xAxis);
  if ((type === 'line' || type === 'area') && (isCategorical || isIdLike)) {
    return { ...chartConfig, type: 'bar' };
  }
  return chartConfig;
};

const parseSchemaContext = (schemaContext: string) => {
  if (!schemaContext) return [];
  const blocks = schemaContext.split(/\n\s*\n/);
  const tables: { name: string; columns: string[] }[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const tableLine = lines.find(line => /^table:/i.test(line));
    if (!tableLine) continue;
    const tableName = tableLine.replace(/table:/i, '').trim();
    const columnsLine = lines.find(line => /^columns:/i.test(line));
    const columns = columnsLine
      ? columnsLine
          .replace(/columns:/i, '')
          .split(',')
          .map(col => col.split('(')[0].trim())
          .filter(Boolean)
      : [];
    tables.push({ name: tableName, columns });
  }
  return tables;
};

const quoteIdentifier = (value: string) => {
  if (!value) return value;
  if (/^".*"$/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

export const fixExcelSql = (sql: string, schemaContext: string, chartConfig?: any) => {
  if (!sql || !schemaContext) return sql;
  let fixed = sql;
  const tables = parseSchemaContext(schemaContext);
  const identifiers = new Set<string>();
  for (const table of tables) {
    if (table.name) identifiers.add(table.name);
    for (const col of table.columns) {
      if (col) identifiers.add(col);
    }
  }

  for (const name of identifiers) {
    if (!name || /^".*"$/.test(name)) continue;
    if (/[^\w]/.test(name)) {
      const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      fixed = fixed.replace(new RegExp(`(?<!")${escaped}(?!")`, 'g'), quoteIdentifier(name));
    }
  }

  fixed = fixed.replace(/\b(sum|avg|min|max)\s*\(\s*([^)]+)\s*\)/gi, (_match, fn, inner) => {
    const trimmed = inner.trim();
    if (/try_cast\s*\(/i.test(trimmed)) return `${fn}(${trimmed})`;
    return `${fn}(TRY_CAST(${trimmed} AS DOUBLE))`;
  });

  if (chartConfig?.yAxis) {
    const yAxis = chartConfig.yAxis;
    if (/[^\w]/.test(yAxis) && !fixed.includes(`"${yAxis}"`)) {
      const escaped = yAxis.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      fixed = fixed.replace(new RegExp(`(?<!")${escaped}(?!")`, 'g'), quoteIdentifier(yAxis));
    }
  }

  return fixed;
};

const stripTrailingLimit = (sql: string) => {
  return sql.replace(/\blimit\s+\d+\s*$/i, '').trim();
};

const normalizeAxisName = (value: string) => {
  if (!value) return value;
  const trimmed = value.replace(/^"+|"+$/g, '').trim();
  if (trimmed.includes('.')) {
    return trimmed.split('.').pop() || trimmed;
  }
  return trimmed;
};

export const wrapCountByQuery = (sql: string, xAxis: string) => {
  if (!sql || !xAxis) return sql;
  const cleaned = sql.replace(/;\s*$/g, '').trim();
  const base = stripTrailingLimit(cleaned);
  const axisName = normalizeAxisName(xAxis);
  const quoted = quoteIdentifier(axisName);
  return `SELECT ${quoted} AS ${quoted}, COUNT(*) AS value FROM (${base}) t GROUP BY ${quoted} ORDER BY value DESC LIMIT 12`;
};

export const deriveCountSeries = (rows: any[], xAxis?: string) => {
  if (!Array.isArray(rows) || rows.length === 0) return { rows: [], xAxis: null };
  const first = rows[0] || {};
  const keys = Object.keys(first);
  const axis = xAxis && keys.includes(xAxis) ? xAxis : (keys[0] || null);
  if (!axis) return { rows: [], xAxis: null };
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row?.[axis];
    const key = raw === null || raw === undefined ? 'Unknown' : String(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const derived = Array.from(counts.entries())
    .map(([key, value]) => ({ [axis]: key, value }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 12);
  return { rows: derived, xAxis: axis };
};
