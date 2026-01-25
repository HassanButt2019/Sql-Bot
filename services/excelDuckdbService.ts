import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';

type DuckDbConnection = duckdb.AsyncDuckDBConnection;

let dbInstance: duckdb.AsyncDuckDB | null = null;
let dbConnection: DuckDbConnection | null = null;

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

export const executeDuckDbQuery = async (sql: string) => {
  const { conn } = await getDuckDb();
  const result = await conn.query(sql);
  return arrowTableToObjects(result);
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
