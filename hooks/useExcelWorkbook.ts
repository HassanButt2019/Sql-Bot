import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import * as XLSX from 'xlsx';
import { DbConnection, ExcelColumn, ExcelSheet, ExcelWorkbook, TableInfo } from '../types';
import { ensureUniqueIdentifiers, getDuckDbTableSchema, registerExcelSheets, sanitizeIdentifier } from '../services/excelDuckdbService';

export const EXCEL_CONNECTION_ID = 'excel-local';

interface IntegrationHistoryItem {
  id: string;
  name: string;
  connectedAt: number;
}

interface UseExcelWorkbookDeps {
  setConnections: Dispatch<SetStateAction<DbConnection[]>>;
  setIntegrationStatuses: Dispatch<SetStateAction<Record<string, 'available' | 'connected'>>>;
  setIntegrationHistory: Dispatch<SetStateAction<IntegrationHistoryItem[]>>;
}

interface UseExcelWorkbookResult {
  excelWorkbook: ExcelWorkbook | null;
  excelActiveSheetId: string | null;
  excelIsLoading: boolean;
  excelError: string | null;
  activeExcelSheet: ExcelSheet | null;
  hasExcelWorkbook: boolean;
  setExcelWorkbook: Dispatch<SetStateAction<ExcelWorkbook | null>>;
  setExcelActiveSheetId: Dispatch<SetStateAction<string | null>>;
  handleExcelUpload: (file: File) => Promise<void>;
  updateExcelWorkbook: (nextWorkbook: ExcelWorkbook | null) => Promise<void>;
  renameExcelColumn: (sheetId: string, columnId: string, nextName: string) => Promise<void>;
  toggleExcelColumn: (sheetId: string, columnId: string, included: boolean) => Promise<void>;
  toggleExcelSheet: (sheetId: string, included: boolean) => Promise<void>;
}

export function useExcelWorkbook(deps: UseExcelWorkbookDeps): UseExcelWorkbookResult {
  const [excelWorkbook, setExcelWorkbook] = useState<ExcelWorkbook | null>(null);
  const [excelActiveSheetId, setExcelActiveSheetId] = useState<string | null>(null);
  const [excelIsLoading, setExcelIsLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  const hasExcelWorkbook = !!excelWorkbook;
  const activeExcelSheet = useMemo(
    () => excelWorkbook?.sheets.find(sheet => sheet.id === excelActiveSheetId) || null,
    [excelWorkbook, excelActiveSheetId]
  );

  const upsertExcelConnection = useCallback((tables: TableInfo[], fileName: string) => {
    const connection: DbConnection = {
      id: EXCEL_CONNECTION_ID,
      name: `Excel: ${fileName}`,
      host: '',
      port: '',
      username: '',
      database: fileName,
      dialect: 'duckdb',
      tables,
      isActive: true,
      status: 'connected',
      isTemporary: true,
      sourceType: 'excel'
    };

    deps.setConnections(prev => {
      const remaining = prev.filter(conn => conn.id !== EXCEL_CONNECTION_ID).map(conn => ({ ...conn, isActive: false }));
      return [...remaining, connection];
    });
  }, [deps]);

  const syncExcelWorkbook = useCallback(async (workbook: ExcelWorkbook) => {
    const sheetsToRegister = workbook.sheets.filter(sheet => sheet.included && sheet.columns.some(col => col.included));
    if (sheetsToRegister.length === 0) {
      deps.setConnections(prev => prev.filter(conn => conn.id !== EXCEL_CONNECTION_ID));
      return;
    }

    await registerExcelSheets(
      sheetsToRegister.map(sheet => ({
        tableName: sheet.tableName,
        columns: sheet.columns,
        data: sheet.data
      }))
    );

    const tableInfos: TableInfo[] = [];
    for (const sheet of sheetsToRegister) {
      const schemaColumns = await getDuckDbTableSchema(sheet.tableName);
      const schema = schemaColumns.map(col => `${col.name} (${col.type})`).join(', ');
      tableInfos.push({
        name: sheet.tableName,
        schema,
        selected: true
      });
    }

    upsertExcelConnection(tableInfos, workbook.fileName);

    deps.setIntegrationStatuses(prev => ({ ...prev, excel: 'connected' }));
    deps.setIntegrationHistory(prev => {
      const existing = prev.find(item => item.id === 'excel');
      if (existing) {
        return prev.map(item => item.id === 'excel'
          ? { ...item, name: `Excel: ${workbook.fileName}`, connectedAt: Date.now() }
          : item
        );
      }
      return [{ id: 'excel', name: `Excel: ${workbook.fileName}`, connectedAt: Date.now() }, ...prev];
    });
  }, [deps, upsertExcelConnection]);

  const getUniqueColumnName = useCallback((desired: string, columns: ExcelColumn[], columnId: string) => {
    const base = sanitizeIdentifier(desired);
    const existing = new Set(columns.filter(col => col.id !== columnId).map(col => col.name));
    if (!existing.has(base)) return base;
    let suffix = 2;
    let candidate = `${base}_${suffix}`;
    while (existing.has(candidate)) {
      suffix += 1;
      candidate = `${base}_${suffix}`;
    }
    return candidate;
  }, []);

  const handleExcelUpload = useCallback(async (file: File) => {
    setExcelIsLoading(true);
    setExcelError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetNames = workbook.SheetNames;
      const tableNames = ensureUniqueIdentifiers(sheetNames);

      const sheets: ExcelSheet[] = sheetNames.map((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        const headerRow = rows[0] || [];
        const maxCols = Math.max(headerRow.length, ...rows.slice(1).map(row => row.length), 0);
        const rawColumns = Array.from({ length: maxCols || headerRow.length || 1 }).map((_, idx) => {
          const value = headerRow[idx];
          return value ? String(value) : `column_${idx + 1}`;
        });
        const columnNames = ensureUniqueIdentifiers(rawColumns);

        const data = rows.slice(1).map((row) => {
          const record: Record<string, any> = {};
          columnNames.forEach((col, colIndex) => {
            record[col] = row?.[colIndex] ?? null;
          });
          return record;
        });

        const columns: ExcelColumn[] = columnNames.map((col, colIndex) => ({
          id: `${tableNames[index]}-${colIndex}-${Date.now()}`,
          name: col,
          originalName: rawColumns[colIndex],
          included: true
        }));

        return {
          id: `${tableNames[index]}-${Date.now()}`,
          name: sheetName,
          tableName: tableNames[index] || sanitizeIdentifier(sheetName),
          columns,
          rowCount: data.length,
          included: true,
          data
        };
      });

      const nextWorkbook: ExcelWorkbook = {
        fileName: file.name,
        sheets
      };

      setExcelWorkbook(nextWorkbook);
      setExcelActiveSheetId(sheets[0]?.id || null);
      await syncExcelWorkbook(nextWorkbook);
    } catch (err: any) {
      setExcelError(err.message || 'Failed to parse Excel file.');
    } finally {
      setExcelIsLoading(false);
    }
  }, [syncExcelWorkbook]);

  const updateExcelWorkbook = useCallback(async (nextWorkbook: ExcelWorkbook | null) => {
    if (!nextWorkbook) return;
    setExcelWorkbook(nextWorkbook);
    setExcelIsLoading(true);
    setExcelError(null);
    try {
      await syncExcelWorkbook(nextWorkbook);
    } catch (err: any) {
      setExcelError(err.message || 'Failed to update Excel schema.');
    } finally {
      setExcelIsLoading(false);
    }
  }, [syncExcelWorkbook]);

  const renameExcelColumn = useCallback(async (sheetId: string, columnId: string, nextName: string) => {
    if (!excelWorkbook) return;
    const sheets = excelWorkbook.sheets.map(sheet => {
      if (sheet.id !== sheetId) return sheet;
      const columns = sheet.columns.map(column => {
        if (column.id !== columnId) return column;
        const uniqueName = getUniqueColumnName(nextName, sheet.columns, columnId);
        return { ...column, name: uniqueName };
      });
      const oldColumn = sheet.columns.find(col => col.id === columnId);
      const newColumn = columns.find(col => col.id === columnId);
      if (!oldColumn || !newColumn || oldColumn.name === newColumn.name) {
        return { ...sheet, columns };
      }
      const data = sheet.data.map(row => {
        const nextRow = { ...row };
        nextRow[newColumn.name] = row[oldColumn.name];
        delete nextRow[oldColumn.name];
        return nextRow;
      });
      return { ...sheet, columns, data };
    });
    await updateExcelWorkbook({ ...excelWorkbook, sheets });
  }, [excelWorkbook, getUniqueColumnName, updateExcelWorkbook]);

  const toggleExcelColumn = useCallback(async (sheetId: string, columnId: string, included: boolean) => {
    if (!excelWorkbook) return;
    const sheets = excelWorkbook.sheets.map(sheet => {
      if (sheet.id !== sheetId) return sheet;
      return {
        ...sheet,
        columns: sheet.columns.map(column => column.id === columnId ? { ...column, included } : column)
      };
    });
    await updateExcelWorkbook({ ...excelWorkbook, sheets });
  }, [excelWorkbook, updateExcelWorkbook]);

  const toggleExcelSheet = useCallback(async (sheetId: string, included: boolean) => {
    if (!excelWorkbook) return;
    const sheets = excelWorkbook.sheets.map(sheet => sheet.id === sheetId ? { ...sheet, included } : sheet);
    await updateExcelWorkbook({ ...excelWorkbook, sheets });
  }, [excelWorkbook, updateExcelWorkbook]);

  return {
    excelWorkbook,
    excelActiveSheetId,
    excelIsLoading,
    excelError,
    activeExcelSheet,
    hasExcelWorkbook,
    setExcelWorkbook,
    setExcelActiveSheetId,
    handleExcelUpload,
    updateExcelWorkbook,
    renameExcelColumn,
    toggleExcelColumn,
    toggleExcelSheet
  };
}
