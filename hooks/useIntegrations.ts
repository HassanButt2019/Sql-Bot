import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { DbConnection, DbConnectionConfig, TableInfo } from '../types';
import { introspectDatabase, parseConnectionString, testDatabaseConnection, validateConnectionString } from '../services/introspectionService';
import { loadIntegrationStateForUser, saveIntegrationStateForUser } from '../services/appPersistence';

interface IntegrationHistoryItem {
  id: string;
  name: string;
  connectedAt: number;
}

interface IntegrationUrlForm {
  connectionString: string;
  username: string;
  password: string;
}

interface IntegrationRelationalForm {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  dialect: DbConnectionConfig['dialect'];
}

interface UseIntegrationsDeps {
  setConnections: Dispatch<SetStateAction<DbConnection[]>>;
  userId?: string | null;
}

export function useIntegrations(deps: UseIntegrationsDeps) {
  const userId = deps.userId ?? null;
  const envConnectionString = import.meta.env.VITE_DB_CONNECTION_STRING || '';
  const envUsername = import.meta.env.VITE_DB_USERNAME || '';
  const envPassword = import.meta.env.VITE_DB_PASSWORD || '';
  const envDialect = (import.meta.env.VITE_DB_DIALECT || 'postgresql') as DbConnectionConfig['dialect'];

  const [integrationCategory, setIntegrationCategory] = useState<'all' | 'databases' | 'nosql' | 'files'>('all');
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [integrationUseUrl, setIntegrationUseUrl] = useState(!!envConnectionString);
  const [integrationUrlForm, setIntegrationUrlForm] = useState<IntegrationUrlForm>({
    connectionString: envConnectionString,
    username: envUsername,
    password: envPassword
  });
  const [integrationRelationalForm, setIntegrationRelationalForm] = useState<IntegrationRelationalForm>({
    name: '',
    host: '',
    port: '5432',
    username: '',
    password: '',
    database: '',
    dialect: envDialect
  });
  const [integrationIsConnecting, setIntegrationIsConnecting] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [integrationTables, setIntegrationTables] = useState<TableInfo[]>([]);
  const [integrationSelectedTableName, setIntegrationSelectedTableName] = useState<string | null>(null);
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, 'available' | 'connected'>>({});
  const [integrationHistory, setIntegrationHistory] = useState<IntegrationHistoryItem[]>([]);
  const [analyticsIntegrationIds, setAnalyticsIntegrationIds] = useState<string[]>([]);

  const integrations = useMemo(() => ([
    { id: 'relational', name: 'Relational (SQL) Databases', category: 'databases', status: 'available', description: 'PostgreSQL, MySQL, SQL Server' },
    { id: 'nosql', name: 'Non-Relational (NoSQL) Databases', category: 'nosql', status: 'available', description: 'MongoDB, DynamoDB, Redis' },
    { id: 'excel', name: 'Excel (XLSX)', category: 'files', status: 'available', description: 'Upload spreadsheets with multiple sheets' }
  ] as const), []);

  const integrationFields: Record<string, { id: string; label: string; type?: string; placeholder?: string }[]> = {
    relational: [
      { id: 'host', label: 'Host', placeholder: 'db.company.com' },
      { id: 'port', label: 'Port', placeholder: '5432' },
      { id: 'database', label: 'Database', placeholder: 'analytics' },
      { id: 'username', label: 'Username', placeholder: 'db_user' },
      { id: 'password', label: 'Password', type: 'password' }
    ],
    nosql: [
      { id: 'uri', label: 'Connection URI', placeholder: 'mongodb+srv://...' },
      { id: 'database', label: 'Database', placeholder: 'analytics' },
      { id: 'username', label: 'Username', placeholder: 'user' },
      { id: 'password', label: 'Password', type: 'password' }
    ]
  };

  useEffect(() => {
    const integrationState = loadIntegrationStateForUser(userId);
    if (integrationState.history.length > 0) setIntegrationHistory(integrationState.history);
    if (integrationState.analyticsIntegrationIds.length > 0) setAnalyticsIntegrationIds(integrationState.analyticsIntegrationIds);
    if (Object.keys(integrationState.statuses).length > 0) setIntegrationStatuses(integrationState.statuses);
  }, [userId]);

  useEffect(() => {
    saveIntegrationStateForUser(integrationHistory, analyticsIntegrationIds, integrationStatuses, userId);
  }, [integrationHistory, analyticsIntegrationIds, integrationStatuses, userId]);

  useEffect(() => {
    if (!selectedIntegrationId && integrations.length > 0) {
      setSelectedIntegrationId(integrations[0].id);
    }
  }, [selectedIntegrationId, integrations.length]);

  useEffect(() => {
    if (selectedIntegrationId !== 'relational') {
      setIntegrationUseUrl(false);
    }
  }, [selectedIntegrationId]);

  useEffect(() => {
    if (selectedIntegrationId !== 'relational') return;
    if (!envConnectionString) return;
    setIntegrationUseUrl(true);
    setIntegrationUrlForm(prev => ({
      connectionString: prev.connectionString || envConnectionString,
      username: prev.username || envUsername,
      password: prev.password || envPassword
    }));
    setIntegrationRelationalForm(prev => ({
      ...prev,
      dialect: prev.dialect || envDialect
    }));
  }, [selectedIntegrationId, envConnectionString, envUsername, envPassword, envDialect]);

  useEffect(() => {
    setIntegrationError(null);
    setIntegrationTables([]);
    setIntegrationSelectedTableName(null);
    if (selectedIntegrationId) {
      const stored = localStorage.getItem(`sqlmind_integration_tables_${selectedIntegrationId}`);
      if (stored) {
        const names = JSON.parse(stored) as string[];
        setIntegrationTables(names.map(name => ({ name, schema: '', selected: true })));
      }
    }
  }, [selectedIntegrationId]);

  useEffect(() => {
    if (integrationTables.length > 0 && !integrationSelectedTableName) {
      setIntegrationSelectedTableName(integrationTables[0].name);
    }
  }, [integrationTables, integrationSelectedTableName]);

  const loadIntegrationSelections = (integrationId: string, tables: TableInfo[]) => {
    const stored = localStorage.getItem(`sqlmind_integration_tables_${integrationId}`);
    if (!stored) return tables;
    try {
      const selectedSet = new Set(JSON.parse(stored) as string[]);
      return tables.map(table => ({ ...table, selected: selectedSet.has(table.name) }));
    } catch {
      return tables;
    }
  };

  const persistIntegrationSelections = (integrationId: string, tables: TableInfo[]) => {
    const selected = tables.filter(t => t.selected).map(t => t.name);
    localStorage.setItem(`sqlmind_integration_tables_${integrationId}`, JSON.stringify(selected));
  };

  const toggleIntegrationTable = (tableName: string) => {
    setIntegrationTables(prev => {
      const next = prev.map(t => t.name === tableName ? { ...t, selected: !t.selected } : t);
      if (selectedIntegrationId) persistIntegrationSelections(selectedIntegrationId, next);
      return next;
    });
  };

  const toggleAllIntegrationTables = (selectAll: boolean) => {
    setIntegrationTables(prev => {
      const next = prev.map(t => ({ ...t, selected: selectAll }));
      if (selectedIntegrationId) persistIntegrationSelections(selectedIntegrationId, next);
      return next;
    });
  };

  const buildIntegrationConfig = () => {
    if (selectedIntegrationId !== 'relational') {
      throw new Error('Only SQL integrations are supported for connection at this time.');
    }

    if (integrationUseUrl) {
      const validation = validateConnectionString(integrationUrlForm.connectionString);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid connection string');
      }
      if (!integrationUrlForm.username || !integrationUrlForm.password) {
        throw new Error('Username and Password are required when using a JDBC connection string');
      }
      const parsed = parseConnectionString(integrationUrlForm.connectionString, integrationRelationalForm.dialect);
      return {
        config: {
          dialect: integrationRelationalForm.dialect,
          ...parsed,
          username: integrationUrlForm.username,
          password: integrationUrlForm.password,
          connectionString: integrationUrlForm.connectionString,
          useConnectionString: true
        },
        name: integrationRelationalForm.name || parsed.database || 'SQL Connection'
      };
    }

    if (!integrationRelationalForm.host || !integrationRelationalForm.database || !integrationRelationalForm.username) {
      throw new Error('Please fill in all required fields: Host, Database, and Username');
    }

    return {
      config: {
        dialect: integrationRelationalForm.dialect,
        host: integrationRelationalForm.host,
        port: integrationRelationalForm.port,
        username: integrationRelationalForm.username,
        password: integrationRelationalForm.password,
        database: integrationRelationalForm.database
      },
      name: integrationRelationalForm.name || integrationRelationalForm.database
    };
  };

  const handleIntegrationTest = async () => {
    setIntegrationError(null);
    if (selectedIntegrationId !== 'relational') {
      setIntegrationError('Only SQL integrations are supported for connection at this time.');
      return;
    }
    setIntegrationIsConnecting(true);

    try {
      const { config } = buildIntegrationConfig();
      const testResult = await testDatabaseConnection(config as DbConnectionConfig);
      if (!testResult.success) {
        throw new Error(testResult.error || 'Connection test failed');
      }
      const tables = await introspectDatabase(config as DbConnectionConfig);
      const withSelections = selectedIntegrationId ? loadIntegrationSelections(selectedIntegrationId, tables) : tables;
      setIntegrationTables(withSelections);
    } catch (err: any) {
      setIntegrationError(err.message || 'Failed to test integration connection.');
    } finally {
      setIntegrationIsConnecting(false);
    }
  };

  const handleIntegrationSave = async () => {
    setIntegrationError(null);
    if (selectedIntegrationId !== 'relational') {
      setIntegrationError('Only SQL integrations are supported for connection at this time.');
      return;
    }
    setIntegrationIsConnecting(true);

    try {
      const { config, name } = buildIntegrationConfig();
      const tables = await introspectDatabase(config as DbConnectionConfig);
      const withSelections = selectedIntegrationId ? loadIntegrationSelections(selectedIntegrationId, tables) : tables;

      const newConn: DbConnection = {
        id: Date.now().toString(),
        name: name,
        host: config.host,
        port: config.port,
        username: config.username,
        database: config.database,
        dialect: config.dialect,
        connectionString: config.connectionString,
        useConnectionString: config.useConnectionString,
        tables: withSelections,
        isActive: true,
        status: 'connected'
      };

      localStorage.setItem(`sqlmind_db_password_${newConn.id}`, config.password || '');
      deps.setConnections(prev => prev.map(c => ({ ...c, isActive: false })).concat(newConn));
      setIntegrationTables(withSelections);
      if (selectedIntegrationId) {
        persistIntegrationSelections(selectedIntegrationId, withSelections);
        setIntegrationStatuses(prev => ({ ...prev, [selectedIntegrationId]: 'connected' }));
        setIntegrationHistory(prev => {
          const exists = prev.find(item => item.id === selectedIntegrationId);
          if (exists) {
            return prev.map(item => item.id === selectedIntegrationId ? { ...item, connectedAt: Date.now() } : item);
          }
          const name = integrations.find(i => i.id === selectedIntegrationId)?.name || selectedIntegrationId;
          return [{ id: selectedIntegrationId, name, connectedAt: Date.now() }, ...prev];
        });
        setAnalyticsIntegrationIds(prev => prev.includes(selectedIntegrationId) ? prev : [selectedIntegrationId, ...prev]);
      }
    } catch (err: any) {
      setIntegrationError(err.message || 'Failed to save integration connection.');
    } finally {
      setIntegrationIsConnecting(false);
    }
  };

  return {
    integrations,
    integrationFields,
    integrationCategory,
    setIntegrationCategory,
    integrationSearch,
    setIntegrationSearch,
    selectedIntegrationId,
    setSelectedIntegrationId,
    integrationUseUrl,
    setIntegrationUseUrl,
    integrationUrlForm,
    setIntegrationUrlForm,
    integrationRelationalForm,
    setIntegrationRelationalForm,
    integrationIsConnecting,
    integrationError,
    integrationTables,
    integrationSelectedTableName,
    setIntegrationSelectedTableName,
    integrationStatuses,
    integrationHistory,
    analyticsIntegrationIds,
    setAnalyticsIntegrationIds,
    toggleIntegrationTable,
    toggleAllIntegrationTables,
    handleIntegrationTest,
    handleIntegrationSave,
    setIntegrationStatuses,
    setIntegrationHistory
  };
}
