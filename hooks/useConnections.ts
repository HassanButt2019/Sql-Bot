import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { DbConnection, DbConnectionConfig, ExcelWorkbook, TableInfo } from '../types';
import { introspectDatabase, parseConnectionString, validateConnectionString } from '../services/introspectionService';
import { executeDuckDbQuery } from '../services/excelDuckdbService';
import { EXCEL_CONNECTION_ID } from './useExcelWorkbook';

interface ConnectionFormState {
  name: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  dialect: DbConnectionConfig['dialect'];
  connectionString: string;
}

interface UseConnectionsDeps {
  connections: DbConnection[];
  setConnections: Dispatch<SetStateAction<DbConnection[]>>;
  connForm: ConnectionFormState;
  setConnForm: Dispatch<SetStateAction<ConnectionFormState>>;
  useConnectionString: boolean;
  setConnectionError: Dispatch<SetStateAction<string | null>>;
  setIsConnecting: Dispatch<SetStateAction<boolean>>;
  excelWorkbook: ExcelWorkbook | null;
  setExcelWorkbook: Dispatch<SetStateAction<ExcelWorkbook | null>>;
  setExcelActiveSheetId: Dispatch<SetStateAction<string | null>>;
}

interface UseConnectionsResult {
  activeConnection: DbConnection | undefined;
  isExcelConnection: boolean;
  localExecutor: ((sql: string) => Promise<any[]>) | undefined;
  handleConnect: () => Promise<void>;
  toggleTable: (connId: string, tableName: string) => void;
  toggleAllTables: (connId: string, selectAll: boolean) => void;
  deleteConnection: (id: string) => void;
  getFullSchemaContext: () => string;
}

export function useConnections(deps: UseConnectionsDeps): UseConnectionsResult {
  const activeConnection = useMemo(
    () => deps.connections.find(c => c.isActive),
    [deps.connections]
  );

  const hasExcelWorkbook = !!deps.excelWorkbook;
  const isExcelConnection = activeConnection?.sourceType === 'excel' || (!activeConnection && hasExcelWorkbook);
  const localExecutor = isExcelConnection ? executeDuckDbQuery : undefined;

  const handleConnect = useCallback(async () => {
    deps.setConnectionError(null);

    if (deps.useConnectionString) {
      const validation = validateConnectionString(deps.connForm.connectionString);
      if (!validation.valid) {
        deps.setConnectionError(validation.error || 'Invalid connection string');
        return;
      }
      if (!deps.connForm.user || !deps.connForm.password) {
        deps.setConnectionError('Username and Password are required when using a JDBC connection string');
        return;
      }
    } else {
      if (!deps.connForm.host || !deps.connForm.database || !deps.connForm.user) {
        deps.setConnectionError('Please fill in all required fields: Host, Database, and User');
        return;
      }
    }

    deps.setIsConnecting(true);

    try {
      let connectionConfig: any = {
        dialect: deps.connForm.dialect,
        password: deps.connForm.password,
      };

      if (deps.useConnectionString && deps.connForm.connectionString) {
        const parsed = parseConnectionString(deps.connForm.connectionString, deps.connForm.dialect);
        connectionConfig = {
          ...connectionConfig,
          ...parsed,
          username: deps.connForm.user || parsed.username,
          password: deps.connForm.password || parsed.password,
          connectionString: deps.connForm.connectionString,
          useConnectionString: true,
        };
      } else {
        connectionConfig = {
          ...connectionConfig,
          host: deps.connForm.host,
          port: deps.connForm.port,
          username: deps.connForm.user,
          database: deps.connForm.database,
        };
      }

      const tables = await introspectDatabase(connectionConfig);

      const newConn: DbConnection = {
        id: Date.now().toString(),
        name: deps.connForm.name || connectionConfig.database,
        host: connectionConfig.host,
        port: connectionConfig.port,
        username: connectionConfig.username,
        database: connectionConfig.database,
        dialect: deps.connForm.dialect,
        connectionString: deps.useConnectionString ? deps.connForm.connectionString : undefined,
        useConnectionString: deps.useConnectionString,
        tables,
        isActive: true,
        status: 'connected'
      };

      localStorage.setItem(`sqlmind_db_password_${newConn.id}`, connectionConfig.password || '');

      deps.setConnections(prev => prev.map(c => ({ ...c, isActive: false })).concat(newConn));
      deps.setConnForm({ name: '', host: '', port: '5432', user: '', password: '', database: '', dialect: 'postgresql', connectionString: '' });
      deps.setConnectionError(null);
    } catch (err: any) {
      console.error(err);
      deps.setConnectionError(err.message || 'Failed to connect to database. Please check your credentials.');
    } finally {
      deps.setIsConnecting(false);
    }
  }, [deps]);

  const toggleTable = useCallback((connId: string, tableName: string) => {
    deps.setConnections(prev => prev.map(conn => conn.id === connId
      ? { ...conn, tables: conn.tables.map(t => t.name === tableName ? { ...t, selected: !t.selected } : t) }
      : conn
    ));
  }, [deps]);

  const toggleAllTables = useCallback((connId: string, selectAll: boolean) => {
    deps.setConnections(prev => prev.map(conn => conn.id === connId
      ? { ...conn, tables: conn.tables.map(t => ({ ...t, selected: selectAll })) }
      : conn
    ));
  }, [deps]);

  const deleteConnection = useCallback((id: string) => {
    localStorage.removeItem(`sqlmind_db_password_${id}`);

    if (id === EXCEL_CONNECTION_ID) {
      deps.setExcelWorkbook(null);
      deps.setExcelActiveSheetId(null);
    }

    const newConns = deps.connections.filter(c => c.id !== id);
    if (activeConnection?.id === id && newConns.length > 0) newConns[0].isActive = true;
    deps.setConnections(newConns);
  }, [activeConnection?.id, deps]);

  const getFullSchemaContext = useCallback(() => {
    if (activeConnection) {
      const selected = activeConnection.tables.filter(t => t.selected);
      if (selected.length === 0) return '';
      return selected.map(t => `TABLE: ${t.name}\nCOLUMNS: ${t.schema}`).join('\n\n');
    }
    if (deps.excelWorkbook) {
      const selectedSheets = deps.excelWorkbook.sheets
        .filter(sheet => sheet.included && sheet.columns.some(col => col.included))
        .map(sheet => {
          const columns = sheet.columns.filter(col => col.included).map(col => `${col.name} (TEXT)`).join(', ');
          return `TABLE: ${sheet.tableName}\nCOLUMNS: ${columns}`;
        });
      return selectedSheets.join('\n\n');
    }
    return '';
  }, [activeConnection, deps.excelWorkbook]);

  return {
    activeConnection,
    isExcelConnection,
    localExecutor,
    handleConnect,
    toggleTable,
    toggleAllTables,
    deleteConnection,
    getFullSchemaContext
  };
}
