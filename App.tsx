import React, { useState, useEffect, useRef } from 'react';
import { Message, Conversation, DashboardItem, DashboardReport, LLMModel, DbConnection, TableInfo, DbDialect, ExcelWorkbook, ExcelSheet, ExcelColumn } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EnhancedDashboard from './components/EnhancedDashboard';
import SqlChart from './components/SqlChart';
import AutoDashboardGenerator from './components/AutoDashboardGenerator';
import { queryModel } from './services/llmRouter';
import { regenerateSingleWidget } from './services/autoDashboardService';
import { introspectDatabase, parseConnectionString, validateConnectionString, testDatabaseConnection } from './services/introspectionService';
import { registerExcelSheets, getDuckDbTableSchema, executeDuckDbQuery, ensureUniqueIdentifiers, sanitizeIdentifier } from './services/excelDuckdbService';
import * as XLSX from 'xlsx';
import { 
  SendIcon, 
  TerminalIcon, 
  LayoutDashboardIcon, 
  MessageSquareIcon, 
  PinIcon, 
  CheckIcon,
  DatabaseIcon,
  Loader2Icon,
  CpuIcon,
  XIcon,
  PlusIcon,
  Edit3Icon,
  SettingsIcon,
  ServerIcon,
  TableIcon,
  Trash2Icon,
  DatabaseZapIcon,
  GlobeIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  FileTextIcon,
  Code2Icon,
  BarChart3Icon,
  Link2Icon,
  AlertCircleIcon,
  SparklesIcon,
  UploadCloudIcon,
  FileSpreadsheetIcon
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EXCEL_CONNECTION_ID = 'excel-local';
const safeStringify = (value: any) => JSON.stringify(value, (_key, val) => (
  typeof val === 'bigint' ? val.toString() : val
));

// Sub-component for Assistant Response to manage local tab state per message
const AssistantResponse: React.FC<{
  msg: Message;
  selectedModel: string;
  onPin: (msg: Message) => void;
  onUpdateScheme: (msgId: string, scheme: string) => void;
}> = ({ msg, selectedModel, onPin, onUpdateScheme }) => {
  const [activeTab, setActiveTab] = useState<'description' | 'sql' | 'chart'>('description');

  const hasSql = !!msg.sql;
  const hasChart = !!(msg.chartConfig && msg.chartData);

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-6 items-start">
        <div className={`w-12 h-12 rounded-2xl ${selectedModel.includes('gpt') ? 'bg-green-600' : 'bg-blue-600'} flex items-center justify-center text-white shrink-0 shadow-xl shadow-blue-500/10`}>
          <CpuIcon className="w-6 h-6" />
        </div>
        
        <div className="flex-1 space-y-4 min-w-0">
          {/* Tab Navigation */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl w-fit no-print">
            <button 
              onClick={() => setActiveTab('description')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'description' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <FileTextIcon className="w-3.5 h-3.5" />
              Insights
            </button>
            <button 
              onClick={() => setActiveTab('sql')}
              disabled={!hasSql}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!hasSql ? 'opacity-30 cursor-not-allowed' : activeTab === 'sql' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Code2Icon className="w-3.5 h-3.5" />
              SQL Query
            </button>
            <button 
              onClick={() => setActiveTab('chart')}
              disabled={!hasChart}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!hasChart ? 'opacity-30 cursor-not-allowed' : activeTab === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <BarChart3Icon className="w-3.5 h-3.5" />
              Visualization
            </button>
          </div>

          {/* Content Area */}
          <div className="relative">
            {activeTab === 'description' && (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300">
                <p className="text-lg text-slate-800 leading-relaxed font-semibold tracking-tight">
                  {msg.content}
                </p>
                {msg.explanation && msg.explanation !== msg.content && (
                  <p className="mt-4 text-slate-500 text-sm leading-relaxed border-t border-slate-50 pt-4">
                    {msg.explanation}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'sql' && hasSql && (
              <div className="bg-slate-950 rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Structured Query</span>
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <pre className="p-8 text-sm font-mono text-indigo-300 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/40">
                    {msg.sql}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'chart' && hasChart && (
              <div className="relative group/chart animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="absolute top-6 right-6 z-10 opacity-0 group-hover/chart:opacity-100 transition-all scale-95 group-hover/chart:scale-100 no-print">
                  <button
                    onClick={() => onPin(msg)}
                    className="flex items-center gap-2 bg-white/95 backdrop-blur-xl text-slate-900 text-[10px] font-black px-5 py-3 rounded-2xl shadow-2xl border border-slate-200 hover:bg-white transition-all active:scale-95"
                  >
                    <PinIcon className="w-3.5 h-3.5 text-indigo-600" />
                    EXPORT TO DASHBOARD
                  </button>
                </div>
                <SqlChart
                  {...msg.chartConfig!}
                  type={msg.chartConfig!.type as 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'composed'}
                  data={msg.chartData!}
                  onUpdateScheme={(scheme) => onUpdateScheme(msg.id, scheme)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'connections' | 'integrations'>('chat');
  
  // Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Dashboard State
  const [dashboards, setDashboards] = useState<DashboardReport[]>([]);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);

  // Add debugging
  useEffect(() => {
    console.log('App component mounted');
    console.log('Active tab:', activeTab);
    console.log('Conversations:', conversations);
    console.log('Dashboards:', dashboards);
  }, [activeTab, conversations, dashboards]);

  // Connection State
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [useConnectionString, setUseConnectionString] = useState(!!import.meta.env.VITE_DB_CONNECTION_STRING);
  const [connForm, setConnForm] = useState({
    name: import.meta.env.VITE_DB_NAME || '',
    host: import.meta.env.VITE_DB_HOST || '',
    port: '5432',
    user: import.meta.env.VITE_DB_USER || '',
    password: import.meta.env.VITE_DB_PASSWORD || '',
    database: import.meta.env.VITE_DB_NAME || '',
    dialect: (import.meta.env.VITE_DB_DIALECT || 'postgresql') as DbDialect,
    connectionString: import.meta.env.VITE_DB_CONNECTION_STRING || ''
  });

  // Export State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [pendingExportMessage, setPendingExportMessage] = useState<Message | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | 'new' | null>(null);
  const [exportDashboardName, setExportDashboardName] = useState('');

  // Auto-Dashboard State
  const [isAutoDashboardOpen, setIsAutoDashboardOpen] = useState(false);

  // Enhanced Dashboard Mode (toggle between basic and enhanced dashboard)
  const [useEnhancedDashboard, setUseEnhancedDashboard] = useState(true);

  // UI State
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openAiApiKey, setOpenAiApiKey] = useState(() => localStorage.getItem('sqlmind_openai_key') || import.meta.env.VITE_OPENAI_API_KEY || '');
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [integrationCategory, setIntegrationCategory] = useState<'all' | 'databases' | 'nosql' | 'graph' | 'crm' | 'ecommerce' | 'files'>('all');
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [integrationUseUrl, setIntegrationUseUrl] = useState(false);
  const [integrationUrlForm, setIntegrationUrlForm] = useState({
    connectionString: import.meta.env.VITE_DB_CONNECTION_STRING || '',
    username: import.meta.env.VITE_DB_USER || '',
    password: import.meta.env.VITE_DB_PASSWORD || ''
  });
  const [integrationRelationalForm, setIntegrationRelationalForm] = useState({
    name: import.meta.env.VITE_DB_NAME || '',
    host: import.meta.env.VITE_DB_HOST || '',
    port: '5432',
    username: import.meta.env.VITE_DB_USER || '',
    password: import.meta.env.VITE_DB_PASSWORD || '',
    database: import.meta.env.VITE_DB_NAME || '',
    dialect: (import.meta.env.VITE_DB_DIALECT || 'postgresql') as DbDialect
  });
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState(import.meta.env.VITE_SHOPIFY_STORE || '');
  const [excelWorkbook, setExcelWorkbook] = useState<ExcelWorkbook | null>(null);
  const [excelActiveSheetId, setExcelActiveSheetId] = useState<string | null>(null);
  const [excelIsLoading, setExcelIsLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [integrationIsConnecting, setIntegrationIsConnecting] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [integrationTables, setIntegrationTables] = useState<TableInfo[]>([]);
  const [integrationSelectedTableName, setIntegrationSelectedTableName] = useState<string | null>(null);
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, 'available' | 'connected'>>({});
  const [integrationHistory, setIntegrationHistory] = useState<{ id: string; name: string; connectedAt: number }[]>([]);
  const [analyticsIntegrationIds, setAnalyticsIntegrationIds] = useState<string[]>([]);

  // LLM Model - fixed to GPT-4o
  const selectedModel: LLMModel = 'gpt-4o';

  const chatEndRef = useRef<HTMLDivElement>(null);

  const integrations = [
    { id: 'relational', name: 'Relational (SQL) Databases', category: 'databases', status: 'available', description: 'PostgreSQL, MySQL, SQL Server' },
    { id: 'nosql', name: 'Non-Relational (NoSQL) Databases', category: 'nosql', status: 'available', description: 'MongoDB, DynamoDB, Redis' },
    // { id: 'graph', name: 'Graph Databases', category: 'graph', status: 'available', description: 'Neo4j, Amazon Neptune' },
    // { id: 'hubspot', name: 'HubSpot', category: 'crm', status: 'available', description: 'CRM, Deals, Contacts' },
    // { id: 'zoho', name: 'Zoho CRM', category: 'crm', status: 'available', description: 'Leads, Accounts, Pipeline' },
    // { id: 'shopify', name: 'Shopify', category: 'ecommerce', status: 'available', description: 'Orders, Products, Customers' },
    { id: 'excel', name: 'Excel (XLSX)', category: 'files', status: 'available', description: 'Upload spreadsheets with multiple sheets' }
  ] as const;

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
    ],
    // graph: [
    //   { id: 'endpoint', label: 'Endpoint', placeholder: 'bolt://host:7687' },
    //   { id: 'database', label: 'Database', placeholder: 'neo4j' },
    //   { id: 'username', label: 'Username', placeholder: 'neo4j' },
    //   { id: 'password', label: 'Password', type: 'password' }
    // ],
    // hubspot: [
    //   { id: 'apiKey', label: 'API Key / Token', placeholder: 'pat-...' },
    //   { id: 'account', label: 'Account ID', placeholder: '123456' }
    // ],
    // zoho: [
    //   { id: 'clientId', label: 'Client ID', placeholder: 'zoho-client-id' },
    //   { id: 'clientSecret', label: 'Client Secret', type: 'password' },
    //   { id: 'refreshToken', label: 'Refresh Token', type: 'password' }
    // ],
    // shopify: [
    //   { id: 'storeUrl', label: 'Store URL', placeholder: 'store.myshopify.com' },
    //   { id: 'accessToken', label: 'Access Token', type: 'password' }
    // ]
  };

  // Initial Load
  useEffect(() => {
    const savedConv = localStorage.getItem('sqlmind_conversations_v3');
    const savedDashboards = localStorage.getItem('sqlmind_dashboards_v3');
    const savedConnections = localStorage.getItem('sqlmind_connections_v3');
    
    if (savedConv) setConversations(JSON.parse(savedConv));
    if (savedDashboards) setDashboards(JSON.parse(savedDashboards));
    if (savedConnections) setConnections(JSON.parse(savedConnections));
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('sqlmind_integration_history');
    const savedAnalytics = localStorage.getItem('sqlmind_integration_analytics');
    const savedStatuses = localStorage.getItem('sqlmind_integration_statuses');
    if (savedHistory) setIntegrationHistory(JSON.parse(savedHistory));
    if (savedAnalytics) setAnalyticsIntegrationIds(JSON.parse(savedAnalytics));
    if (savedStatuses) setIntegrationStatuses(JSON.parse(savedStatuses));
  }, []);

  useEffect(() => {
    localStorage.setItem('sqlmind_integration_history', JSON.stringify(integrationHistory));
    localStorage.setItem('sqlmind_integration_analytics', JSON.stringify(analyticsIntegrationIds));
    localStorage.setItem('sqlmind_integration_statuses', JSON.stringify(integrationStatuses));
  }, [integrationHistory, analyticsIntegrationIds, integrationStatuses]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('sqlmind_conversations_v3', safeStringify(conversations));
    localStorage.setItem('sqlmind_dashboards_v3', safeStringify(dashboards));
    const persistedConnections = connections.filter(connection => !connection.isTemporary);
    localStorage.setItem('sqlmind_connections_v3', safeStringify(persistedConnections));
  }, [conversations, dashboards, connections]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentChatId, isTyping]);

  const activeConnection = connections.find(c => c.isActive);
  const currentConversation = conversations.find(c => c.id === currentChatId);
  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);
  const activeExcelSheet = excelWorkbook?.sheets.find(sheet => sheet.id === excelActiveSheetId) || null;

  useEffect(() => {
    if (!activeConnection || !activeConnection.tables.length) {
      setSelectedTableName(null);
      return;
    }
    if (!selectedTableName || !activeConnection.tables.some(t => t.name === selectedTableName)) {
      setSelectedTableName(activeConnection.tables[0].name);
    }
  }, [activeConnection, selectedTableName]);

  useEffect(() => {
    if (!selectedIntegrationId && integrations.length > 0) {
      setSelectedIntegrationId(integrations[0].id);
    }
  }, [selectedIntegrationId, integrations.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopifyStatus = params.get('shopify');
    const shop = params.get('shop');
    if (shopifyStatus === 'connected' && shop) {
      setSelectedIntegrationId('shopify');
      setShopifyStoreDomain(shop);
      setIntegrationStatuses(prev => ({ ...prev, shopify: 'connected' }));
      setIntegrationHistory(prev => {
        const exists = prev.find(item => item.id === 'shopify');
        if (exists) {
          return prev.map(item => item.id === 'shopify' ? { ...item, connectedAt: Date.now() } : item);
        }
        return [{ id: 'shopify', name: 'Shopify', connectedAt: Date.now() }, ...prev];
      });
      setAnalyticsIntegrationIds(prev => prev.includes('shopify') ? prev : ['shopify', ...prev]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (selectedIntegrationId !== 'relational') {
      setIntegrationUseUrl(false);
    }
  }, [selectedIntegrationId]);

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

  const handleConnect = async () => {
    setConnectionError(null);
    
    // Validate inputs based on connection mode
    if (useConnectionString) {
      const validation = validateConnectionString(connForm.connectionString);
      if (!validation.valid) {
        setConnectionError(validation.error || 'Invalid connection string');
        return;
      }
      // Also validate username/password for JDBC URLs that don't include credentials
      if (!connForm.user || !connForm.password) {
        setConnectionError('Username and Password are required when using a JDBC connection string');
        return;
      }
    } else {
      if (!connForm.host || !connForm.database || !connForm.user) {
        setConnectionError('Please fill in all required fields: Host, Database, and User');
        return;
      }
    }
    
    setIsConnecting(true);
    
    try {
      let connectionConfig: any = {
        dialect: connForm.dialect,
        password: connForm.password,
      };

      // If using connection string, parse it to get individual values
      if (useConnectionString && connForm.connectionString) {
        const parsed = parseConnectionString(connForm.connectionString, connForm.dialect);
        connectionConfig = {
          ...connectionConfig,
          ...parsed,
          // Override with form values if provided (for JDBC URLs that don't include credentials)
          username: connForm.user || parsed.username,
          password: connForm.password || parsed.password,
          connectionString: connForm.connectionString,
          useConnectionString: true,
        };
      } else {
        connectionConfig = {
          ...connectionConfig,
          host: connForm.host,
          port: connForm.port,
          username: connForm.user,
          database: connForm.database,
        };
      }

      const tables = await introspectDatabase(connectionConfig);

      const newConn: DbConnection = {
        id: Date.now().toString(),
        name: connForm.name || connectionConfig.database,
        host: connectionConfig.host,
        port: connectionConfig.port,
        username: connectionConfig.username,
        database: connectionConfig.database,
        dialect: connForm.dialect,
        connectionString: useConnectionString ? connForm.connectionString : undefined,
        useConnectionString: useConnectionString,
        tables: tables,
        isActive: true,
        status: 'connected'
      };

      // Store password securely for SQL execution (needed for queries)
      localStorage.setItem(`sqlmind_db_password_${newConn.id}`, connectionConfig.password || '');

      setConnections(prev => prev.map(c => ({...c, isActive: false})).concat(newConn));
      setConnForm({ name: '', host: '', port: '5432', user: '', password: '', database: '', dialect: 'postgresql', connectionString: '' });
      setConnectionError(null);
    } catch (err: any) {
      console.error(err);
      setConnectionError(err.message || 'Failed to connect to database. Please check your credentials.');
    } finally {
      setIsConnecting(false);
    }
  };

  const getFullSchemaContext = () => {
    if (activeConnection) {
      const selected = activeConnection.tables.filter(t => t.selected);
      if (selected.length === 0) return '';
      return selected.map(t => `TABLE: ${t.name}\nCOLUMNS: ${t.schema}`).join('\n\n');
    }
    if (excelWorkbook) {
      const selectedSheets = excelWorkbook.sheets
        .filter(sheet => sheet.included && sheet.columns.some(col => col.included))
        .map(sheet => {
          const columns = sheet.columns.filter(col => col.included).map(col => `${col.name} (TEXT)`).join(', ');
          return `TABLE: ${sheet.tableName}\nCOLUMNS: ${columns}`;
        });
      return selectedSheets.join('\n\n');
    }
    return '';
  };

  const hasExcelWorkbook = !!excelWorkbook;
  const isExcelConnection = activeConnection?.sourceType === 'excel' || (!activeConnection && hasExcelWorkbook);
  const localExecutor = isExcelConnection ? executeDuckDbQuery : undefined;

  const upsertExcelConnection = (tables: TableInfo[], fileName: string) => {
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

    setConnections(prev => {
      const remaining = prev.filter(conn => conn.id !== EXCEL_CONNECTION_ID).map(conn => ({ ...conn, isActive: false }));
      return [...remaining, connection];
    });
  };

  const syncExcelWorkbook = async (workbook: ExcelWorkbook) => {
    const sheetsToRegister = workbook.sheets.filter(sheet => sheet.included && sheet.columns.some(col => col.included));
    if (sheetsToRegister.length === 0) {
      setConnections(prev => prev.filter(conn => conn.id !== EXCEL_CONNECTION_ID));
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

    setIntegrationStatuses(prev => ({ ...prev, excel: 'connected' }));
    setIntegrationHistory(prev => {
      const existing = prev.find(item => item.id === 'excel');
      if (existing) {
        return prev.map(item => item.id === 'excel'
          ? { ...item, name: `Excel: ${workbook.fileName}`, connectedAt: Date.now() }
          : item
        );
      }
      return [{ id: 'excel', name: `Excel: ${workbook.fileName}`, connectedAt: Date.now() }, ...prev];
    });
  };

  const getUniqueColumnName = (desired: string, columns: ExcelColumn[], columnId: string) => {
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
  };

  const handleExcelUpload = async (file: File) => {
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
  };

  const updateExcelWorkbook = async (nextWorkbook: ExcelWorkbook | null) => {
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
  };

  const renameExcelColumn = async (sheetId: string, columnId: string, nextName: string) => {
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
  };

  const toggleExcelColumn = async (sheetId: string, columnId: string, included: boolean) => {
    if (!excelWorkbook) return;
    const sheets = excelWorkbook.sheets.map(sheet => {
      if (sheet.id !== sheetId) return sheet;
      return {
        ...sheet,
        columns: sheet.columns.map(column => column.id === columnId ? { ...column, included } : column)
      };
    });
    await updateExcelWorkbook({ ...excelWorkbook, sheets });
  };

  const toggleExcelSheet = async (sheetId: string, included: boolean) => {
    if (!excelWorkbook) return;
    const sheets = excelWorkbook.sheets.map(sheet => sheet.id === sheetId ? { ...sheet, included } : sheet);
    await updateExcelWorkbook({ ...excelWorkbook, sheets });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isTyping || (!activeConnection && !excelWorkbook)) return;
    
    if (!openAiApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    let targetId = currentChatId;
    if (!targetId) {
      const id = Date.now().toString();
      const newConv: Conversation = { id, title: userInput.slice(0, 30) + '...', messages: [], updatedAt: Date.now(), model: 'gpt-4o' };
      setConversations([newConv, ...conversations]);
      targetId = id;
      setCurrentChatId(id);
    }

    const schemaContext = getFullSchemaContext();
    if (!schemaContext) {
      setActiveTab('connections');
      return;
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userInput, timestamp: Date.now() };
    const botMessagePlaceholder: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Analyzing schema...', timestamp: Date.now() };

    setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: [...c.messages, userMessage, botMessagePlaceholder], updatedAt: Date.now() } : c));
    setUserInput('');
    setIsTyping(true);

    try {
      const result = await queryModel(
        userMessage.content,
        schemaContext,
        openAiApiKey,
        isExcelConnection ? null : activeConnection,
        (chunkText) => {
        setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, content: chunkText } : m) } : c));
        },
        localExecutor
      );
      
      setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, ...result, content: result.content || "Report generated." } : m) } : c));
    } catch (error: any) {
      console.error(error);
      setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, content: `Error: ${error.message}` } : m) } : c));
    } finally {
      setIsTyping(false);
    }
  };

  const toggleTable = (connId: string, tableName: string) => {
    setConnections(prev => prev.map(conn => conn.id === connId ? { ...conn, tables: conn.tables.map(t => t.name === tableName ? { ...t, selected: !t.selected } : t) } : conn));
  };

  const toggleAllTables = (connId: string, selectAll: boolean) => {
    setConnections(prev => prev.map(conn => conn.id === connId ? { ...conn, tables: conn.tables.map(t => ({ ...t, selected: selectAll })) } : conn));
  };

  const deleteConnection = (id: string) => {
    // Remove stored password
    localStorage.removeItem(`sqlmind_db_password_${id}`);

    if (id === EXCEL_CONNECTION_ID) {
      setExcelWorkbook(null);
      setExcelActiveSheetId(null);
    }
    
    const newConns = connections.filter(c => c.id !== id);
    if (activeConnection?.id === id && newConns.length > 0) newConns[0].isActive = true;
    setConnections(newConns);
  };

  const updateMessageColorScheme = (messageId: string, scheme: string) => {
    setConversations(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: c.messages.map(m => m.id === messageId && m.chartConfig ? { ...m, chartConfig: { ...m.chartConfig, colorScheme: scheme as any } } : m) } : c));
  };

  const updateDashboardItemColorScheme = (itemId: string, scheme: string) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { ...d, items: d.items.map(item => item.id === itemId ? { ...item, chartConfig: { ...item.chartConfig, colorScheme: scheme as any } } : item) } : d));
  };

  const removeFromDashboard = (itemId: string) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { ...d, items: d.items.filter(item => item.id !== itemId), updatedAt: Date.now() } : d));
  };

  const updateDashboardItemSize = (itemId: string, size: 4 | 6 | 12) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { 
      ...d, 
      items: d.items.map(item => item.id === itemId ? { ...item, colSpan: size } : item),
      updatedAt: Date.now()
    } : d));
  };

  // EnhancedDashboard handlers
  const updateDashboardItem = (itemId: string, updates: Partial<DashboardItem>) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { 
      ...d, 
      items: d.items.map(item => item.id === itemId ? { ...item, ...updates } : item),
      updatedAt: Date.now()
    } : d));
  };

  const updateDashboardLayout = (updatedItems: DashboardItem[]) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { 
      ...d, 
      items: updatedItems,
      updatedAt: Date.now()
    } : d));
  };

  const appendDashboardItems = (newItems: DashboardItem[]) => {
    if (!currentDashboardId || newItems.length === 0) return;
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? {
      ...d,
      items: [...newItems, ...d.items],
      updatedAt: Date.now()
    } : d));
  };

  const handleRegenerateWidget = async (widgetId: string, sql: string, refinementPrompt?: string): Promise<void> => {
    if (!activeConnection || !openAiApiKey) return;
    
    const widget = currentDashboard?.items.find(i => i.id === widgetId);
    if (!widget) return;

    // Update widget to loading state
    updateDashboardItem(widgetId, { isLoading: true, sqlError: undefined });

    try {
      const schemaContext = getFullSchemaContext();
      
      // Convert DashboardItem to AutoDashboardWidget format for regeneration
      const widgetForRegeneration = {
        id: widget.id,
        title: widget.title,
        sql: widget.sql || sql,
        explanation: '', // Required by AutoDashboardWidget
        sqlError: widget.sqlError,
        chartConfig: {
          type: widget.chartConfig.type as 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'composed',
          xAxis: widget.chartConfig.xAxis,
          yAxis: widget.chartConfig.yAxis,
          title: widget.chartConfig.title,
          colorScheme: widget.chartConfig.colorScheme
        },
        chartData: widget.chartData,
        addedAt: widget.addedAt
      };
      
      const regeneratedWidget = await regenerateSingleWidget(
        widgetForRegeneration,
        schemaContext,
        openAiApiKey,
        isExcelConnection ? null : activeConnection,
        refinementPrompt, // Pass refinement prompt to the service
        localExecutor
      );

      updateDashboardItem(widgetId, {
        chartData: regeneratedWidget.chartData,
        sql: regeneratedWidget.sql,
        isLoading: false,
        sqlError: regeneratedWidget.sqlError,
        lastRefreshed: Date.now()
      });
    } catch (error: any) {
      updateDashboardItem(widgetId, {
        isLoading: false,
        sqlError: error.message || 'Failed to regenerate widget'
      });
    }
  };

  const openExportDialog = (message: Message) => {
    setPendingExportMessage(message);
    setSelectedTargetId(currentDashboardId || (dashboards.length > 0 ? dashboards[0].id : 'new'));
    setIsExportDialogOpen(true);
  };

  // Auto-Dashboard handler - creates a new dashboard with generated widgets
  const handleAutoDashboardGenerated = (items: DashboardItem[], title: string) => {
    const newDashboardId = Date.now().toString();
    const newDashboard: DashboardReport = {
      id: newDashboardId,
      title: title,
      items: items,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setDashboards(prev => [newDashboard, ...prev]);
    setCurrentDashboardId(newDashboardId);
    setActiveTab('dashboard');
  };

  const handleFinalExport = () => {
    if (!pendingExportMessage?.chartConfig || !pendingExportMessage?.chartData) return;
    let targetId = selectedTargetId;
    let updatedDashboards = [...dashboards];
    if (targetId === 'new') {
      const newId = Date.now().toString();
      updatedDashboards = [{ id: newId, title: exportDashboardName || 'New Analysis', items: [], createdAt: Date.now(), updatedAt: Date.now() }, ...dashboards];
      targetId = newId;
    }
    const newItem: DashboardItem = { id: Date.now().toString(), title: pendingExportMessage.chartConfig.title, chartConfig: { ...pendingExportMessage.chartConfig }, chartData: JSON.parse(JSON.stringify(pendingExportMessage.chartData)), addedAt: Date.now(), colSpan: 6, height: 500 };
    updatedDashboards = updatedDashboards.map(d => d.id === targetId ? { ...d, items: [newItem, ...d.items], updatedAt: Date.now() } : d);
    setDashboards(updatedDashboards);
    setIsExportDialogOpen(false);
    setPendingExportMessage(null);
    setCurrentDashboardId(targetId);
    setActiveTab('dashboard');
  };

  const handleNewConnection = () => {
    setConnForm({ name: '', host: '', port: '5432', user: '', password: '', database: '', dialect: 'postgresql', connectionString: '' });
    setConnectionError(null);
    setActiveTab('connections');
  };

  const loadIntegrationSelections = (integrationId: string, tables: TableInfo[]) => {
    const stored = localStorage.getItem(`sqlmind_integration_tables_${integrationId}`);
    if (!stored) return tables;
    const selectedSet = new Set(JSON.parse(stored) as string[]);
    return tables.map(t => ({ ...t, selected: selectedSet.has(t.name) }));
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
      setConnections(prev => prev.map(c => ({ ...c, isActive: false })).concat(newConn));
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

  const handleShopifyConnect = async () => {
    setIntegrationError(null);
    if (!shopifyStoreDomain || !shopifyStoreDomain.endsWith('.myshopify.com')) {
      setIntegrationError('Please enter a valid Shopify store domain (e.g., mystore.myshopify.com).');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/shopify/authorize?shop=${encodeURIComponent(shopifyStoreDomain)}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Shopify OAuth endpoint returned an unexpected response. Check server logs.');
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to start Shopify OAuth.');
      }
      window.location.href = result.url;
    } catch (err: any) {
      setIntegrationError(err.message || 'Shopify OAuth failed.');
    }
  };

  const handleShopifyStatus = async () => {
    setIntegrationError(null);
    if (!shopifyStoreDomain || !shopifyStoreDomain.endsWith('.myshopify.com')) {
      setIntegrationError('Please enter a valid Shopify store domain (e.g., mystore.myshopify.com).');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/shopify/status?shop=${encodeURIComponent(shopifyStoreDomain)}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Shopify status endpoint returned an unexpected response. Check server logs.');
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to check Shopify status.');
      }
      if (result.connected) {
        setIntegrationStatuses(prev => ({ ...prev, shopify: 'connected' }));
        setIntegrationHistory(prev => {
          const exists = prev.find(item => item.id === 'shopify');
          if (exists) {
            return prev.map(item => item.id === 'shopify' ? { ...item, connectedAt: Date.now() } : item);
          }
          return [{ id: 'shopify', name: 'Shopify', connectedAt: Date.now() }, ...prev];
        });
      } else {
        setIntegrationError('Shopify is not connected yet.');
      }
    } catch (err: any) {
      setIntegrationError(err.message || 'Failed to check Shopify status.');
    }
  };

  const parseSchemaColumns = (schema: string) => {
    const columns: { name: string; details: string }[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < schema.length; i++) {
      const char = schema[i];
      if (char === '(') depth += 1;
      if (char === ')') depth = Math.max(0, depth - 1);

      if (char === ',' && depth === 0) {
        if (current.trim()) columns.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }

    if (current.trim()) columns.push(current.trim());

    return columns.map((entry) => {
      const openIndex = entry.indexOf('(');
      if (openIndex === -1) return { name: entry, details: '' };
      const name = entry.slice(0, openIndex).trim();
      const details = entry.slice(openIndex + 1, entry.lastIndexOf(')')).trim();
      return { name, details };
    });
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <Sidebar 
        mode={activeTab}
        items={
          (activeTab === 'chat'
            ? conversations
            : activeTab === 'dashboard'
              ? dashboards
              : activeTab === 'connections'
                ? connections
                : []).filter(item => {
              if (activeTab === 'connections') {
                return (item as DbConnection).name.toLowerCase().includes(searchQuery.toLowerCase());
              }
              if (activeTab === 'integrations') {
                return false;
              }
              return (item as Conversation | DashboardReport).title.toLowerCase().includes(searchQuery.toLowerCase());
            })
        }
        currentId={activeTab === 'chat' ? currentChatId : activeTab === 'dashboard' ? currentDashboardId : activeTab === 'connections' ? activeConnection?.id || null : null}
        onSelect={(id) => {
          if (activeTab === 'chat') setCurrentChatId(id);
          if (activeTab === 'dashboard') setCurrentDashboardId(id);
          if (activeTab === 'connections') setConnections(prev => prev.map(c => ({ ...c, isActive: c.id === id })));
        }}
        onNew={() => {
          if (activeTab === 'chat') return setCurrentChatId(null);
          if (activeTab === 'connections') return handleNewConnection();
        }}
        onDelete={(id) => {
          if (activeTab === 'chat') return setConversations(c => c.filter(x => x.id !== id));
          if (activeTab === 'dashboard') return setDashboards(d => d.filter(x => x.id !== id));
          if (activeTab === 'connections') return deleteConnection(id);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNavigateIntegrations={() => setActiveTab('integrations')}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 z-40">
          <nav className="flex items-center p-1 bg-slate-100 rounded-xl">
            {['chat', 'dashboard'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                {tab === 'chat' ? <MessageSquareIcon className="w-4 h-4" /> : <LayoutDashboardIcon className="w-4 h-4" />}
                {tab.toUpperCase()}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600">
              {activeConnection ? activeConnection.name : 'No Connection'}
            </div>
            {activeTab === 'chat' && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase tracking-widest">
                  <CpuIcon className="w-4 h-4 text-green-500" />
                  GPT-4o
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${openAiApiKey ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  {openAiApiKey ? 'API Key Set' : 'Set API Key'}
                </button>
              </>
            )}
            {activeTab === 'dashboard' && (
              <button 
                onClick={() => setIsAutoDashboardOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                Auto-Generate Dashboard
              </button>
            )}
            <button 
              onClick={() => setActiveTab('connections')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black shadow-lg shadow-slate-900/10"
            >
              <DatabaseIcon className={`w-3.5 h-3.5 ${activeConnection ? 'text-green-400' : 'text-slate-400'}`} />
              <span className="max-w-[120px] truncate">{activeConnection ? activeConnection.database : 'Connect DB'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'integrations' ? (
            <div className="h-full overflow-y-auto p-8">
              <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[80vh]">
                <div className="flex items-center justify-between px-10 pt-8 pb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Integrations</h3>
                    <p className="text-xs text-slate-500 font-medium">Connect external sources and sync data</p>
                  </div>
                </div>

                <div className="px-10 pb-10 grid grid-cols-12 gap-8">
                  <div className="col-span-4 bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Sources</label>
                      <input
                        value={integrationSearch}
                        onChange={(e) => setIntegrationSearch(e.target.value)}
                        placeholder="Search SQL, NoSQL, HubSpot..."
                        className="mt-2 w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categories</p>
                      {[
                        { id: 'all', label: 'All Sources' },
                        { id: 'databases', label: 'Relational (SQL)' },
                        { id: 'nosql', label: 'NoSQL' },
                        // { id: 'graph', label: 'Graph' },
                        // { id: 'crm', label: 'CRM' },
                        // { id: 'ecommerce', label: 'E-commerce' },
                        { id: 'files', label: 'Files' }
                      ].map(category => (
                        <button
                          key={category.id}
                          onClick={() => setIntegrationCategory(category.id as any)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                            integrationCategory === category.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connected</p>
                      {integrationHistory.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">No connected integrations yet.</div>
                      ) : (
                        integrationHistory.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2">
                            <button
                              onClick={() => setSelectedIntegrationId(item.id)}
                              className="text-left text-xs font-semibold text-slate-700 truncate"
                            >
                              {item.name}
                            </button>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <input
                                type="checkbox"
                                checked={analyticsIntegrationIds.includes(item.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setAnalyticsIntegrationIds(prev => checked ? [...prev, item.id] : prev.filter(id => id !== item.id));
                                }}
                                className="w-3.5 h-3.5 text-blue-600 rounded"
                              />
                              Analytics
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                      {integrations
                        .filter(item => integrationCategory === 'all' || item.category === integrationCategory)
                        .filter(item => item.name.toLowerCase().includes(integrationSearch.toLowerCase()))
                        .map(item => (
                          <button
                            key={item.id}
                            onClick={() => setSelectedIntegrationId(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                              selectedIntegrationId === item.id ? 'bg-white border border-blue-500 text-slate-900 shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-200'
                            }`}
                          >
                            <span>{item.name}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${
                              integrationStatuses[item.id] === 'connected' ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {integrationStatuses[item.id] === 'connected' ? 'Connected' : 'Available'}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="col-span-8">
                    {selectedIntegrationId === 'excel' ? (
                      <div className="p-6 bg-white border border-slate-100 rounded-3xl space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel Upload</p>
                            <h4 className="text-xl font-black text-slate-900">Upload Spreadsheet</h4>
                            <p className="text-xs text-slate-500 mt-1">All sheets are loaded for analysis. Columns can be renamed or removed.</p>
                          </div>
                        </div>

                        <div className="border border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50">
                          <input
                            id="excel-upload-input"
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleExcelUpload(file);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          <label
                            htmlFor="excel-upload-input"
                            className="flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-all"
                          >
                            <UploadCloudIcon className="w-5 h-5" />
                            Upload Excel File
                          </label>
                          {excelWorkbook && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                              <FileSpreadsheetIcon className="w-4 h-4" />
                              <span>{excelWorkbook.fileName}</span>
                            </div>
                          )}
                          {excelIsLoading && (
                            <div className="mt-3 text-xs font-semibold text-blue-600">Preparing Excel data...</div>
                          )}
                          {excelError && (
                            <div className="mt-3 text-xs font-semibold text-red-600">{excelError}</div>
                          )}
                        </div>

                        {excelWorkbook && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FileSpreadsheetIcon className="w-4 h-4 text-blue-500" />
                                  <span className="text-xs font-bold text-slate-700">Sheets</span>
                                </div>
                              </div>
                              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                {excelWorkbook.sheets.map(sheet => (
                                  <div
                                    key={sheet.id}
                                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border transition-all ${
                                      activeExcelSheet?.id === sheet.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                                    }`}
                                  >
                                    <button
                                      onClick={() => setExcelActiveSheetId(sheet.id)}
                                      className="text-left flex-1"
                                    >
                                      <p className="text-sm font-bold text-slate-800">{sheet.name}</p>
                                      <p className="text-[10px] text-slate-500">{sheet.rowCount} rows</p>
                                    </button>
                                    <input
                                      type="checkbox"
                                      checked={sheet.included}
                                      onChange={(e) => toggleExcelSheet(sheet.id, e.target.checked)}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FileTextIcon className="w-4 h-4 text-blue-500" />
                                  <span className="text-xs font-bold text-slate-700">Columns</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {activeExcelSheet ? activeExcelSheet.name : 'No sheet selected'}
                                </span>
                              </div>
                              {activeExcelSheet ? (
                                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                  {activeExcelSheet.columns.map(column => (
                                    <div key={column.id} className="flex items-center gap-2">
                                      <input
                                        value={column.name}
                                        onChange={(e) => renameExcelColumn(activeExcelSheet.id, column.id, e.target.value)}
                                        disabled={!column.included}
                                        className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold ${
                                          column.included ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-100 text-slate-400 line-through'
                                        }`}
                                      />
                                      <button
                                        onClick={() => toggleExcelColumn(activeExcelSheet.id, column.id, !column.included)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                          column.included
                                            ? 'bg-red-50 text-red-600 border border-red-200'
                                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                        }`}
                                      >
                                        {column.included ? 'Remove' : 'Restore'}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400 italic">Select a sheet to edit columns.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 bg-white border border-slate-100 rounded-3xl">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connection</p>
                          <h4 className="text-xl font-black text-slate-900">
                            {integrations.find(i => i.id === selectedIntegrationId)?.name || 'Select a source'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">Enter credentials for the selected source.</p>
                        </div>
                        {selectedIntegrationId === 'relational' && (
                          <button
                            onClick={() => setIntegrationUseUrl(!integrationUseUrl)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              integrationUseUrl ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-300'
                            }`}
                          >
                            <Link2Icon className="w-3 h-3" />
                            {integrationUseUrl ? 'Using URL' : 'Use URL'}
                          </button>
                        )}
                      </div>

                      {selectedIntegrationId === 'shopify' ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Shopify Store Domain</label>
                            <input
                              value={shopifyStoreDomain}
                              onChange={(e) => setShopifyStoreDomain(e.target.value)}
                              placeholder="mystore.myshopify.com"
                              className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleShopifyConnect}
                              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700"
                            >
                              Connect Shopify
                            </button>
                            <button
                              onClick={handleShopifyStatus}
                              className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest"
                            >
                              Check Status
                            </button>
                          </div>
                        </div>
                      ) : selectedIntegrationId === 'relational' && integrationUseUrl ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Connection URL</label>
                            <input
                              value={integrationUrlForm.connectionString}
                              onChange={(e) => setIntegrationUrlForm(prev => ({ ...prev, connectionString: e.target.value }))}
                              placeholder="postgresql://user:pass@host:5432/db"
                              className="w-full p-3 rounded-xl border text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-2">Supports JDBC/URL format for SQL databases.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Username</label>
                              <input
                                value={integrationUrlForm.username}
                                onChange={(e) => setIntegrationUrlForm(prev => ({ ...prev, username: e.target.value }))}
                                className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Password</label>
                              <input
                                type="password"
                                value={integrationUrlForm.password}
                                onChange={(e) => setIntegrationUrlForm(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {(integrationFields[selectedIntegrationId || 'relational'] || []).map(field => (
                            <div key={field.id} className="col-span-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">{field.label}</label>
                              <input
                                type={field.type || 'text'}
                                placeholder={field.placeholder}
                                value={
                                  selectedIntegrationId === 'relational' && field.id in integrationRelationalForm
                                    ? (integrationRelationalForm as any)[field.id]
                                    : undefined
                                }
                                onChange={(e) => {
                                  if (selectedIntegrationId === 'relational') {
                                    setIntegrationRelationalForm(prev => ({ ...prev, [field.id]: e.target.value }));
                                  }
                                }}
                                className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedIntegrationId !== 'relational' && selectedIntegrationId !== 'shopify' && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-4 py-3 text-xs font-semibold">
                          Shopify, HubSpot, Zoho, and other non-SQL sources require a connector. Connection testing is disabled for now.
                        </div>
                      )}

                      {selectedIntegrationId === 'relational' && (
                        <div className="mt-6 grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Sync Frequency</label>
                            <select className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                              <option>Hourly</option>
                              <option>Daily</option>
                              <option>Weekly</option>
                            </select>
                          </div>
                          <div className="flex items-end gap-3">
                            <button
                              onClick={handleIntegrationTest}
                              disabled={integrationIsConnecting || selectedIntegrationId !== 'relational'}
                              className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                            >
                              {integrationIsConnecting ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                              onClick={handleIntegrationSave}
                              disabled={integrationIsConnecting || selectedIntegrationId !== 'relational'}
                              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50"
                            >
                              {integrationIsConnecting ? 'Saving...' : 'Save Integration'}
                            </button>
                          </div>
                        </div>
                      )}

                      {integrationError && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-xs font-semibold">
                          {integrationError}
                        </div>
                      )}

                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <TableIcon className="w-4 h-4 text-blue-500" />
                              <span className="text-xs font-bold text-slate-700">Tables</span>
                            </div>
                            {integrationTables.length > 0 && (
                              <button
                                onClick={() => {
                                  const allSelected = integrationTables.every(t => t.selected);
                                  toggleAllIntegrationTables(!allSelected);
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                              >
                                {integrationTables.every(t => t.selected) ? 'Clear All' : 'Select All'}
                              </button>
                            )}
                          </div>
                          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                            {integrationTables.map(table => (
                              <div
                                key={table.name}
                                onClick={() => setIntegrationSelectedTableName(table.name)}
                                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border transition-all cursor-pointer ${
                                  integrationSelectedTableName === table.name ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{table.name}</p>
                                </div>
                                <input type="checkbox" checked={table.selected} onChange={() => toggleIntegrationTable(table.name)} className="w-4 h-4 text-blue-600 rounded" />
                              </div>
                            ))}
                            {integrationTables.length === 0 && (
                              <div className="h-full flex items-center justify-center text-slate-400 italic text-sm text-center">
                                Tables will appear here after connection.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <FileTextIcon className="w-4 h-4 text-blue-500" />
                              <span className="text-xs font-bold text-slate-700">Schema</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {integrationSelectedTableName || 'No table selected'}
                            </span>
                          </div>
                          {integrationSelectedTableName ? (
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 max-h-[280px] overflow-y-auto custom-scrollbar">
                              {parseSchemaColumns(
                                integrationTables.find(t => t.name === integrationSelectedTableName)?.schema || ''
                              ).map((column, idx) => (
                                <div key={`${integrationSelectedTableName}-${idx}`} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                                  <span className="text-xs font-semibold text-slate-700 truncate">{column.name}</span>
                                  <span className="text-[10px] font-mono text-slate-500 text-right">{column.details}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">Select a table to view its schema details.</div>
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'connections' ? (
            <div className="h-full overflow-y-auto p-8">
              <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[80vh]">
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between px-10 pt-8 pb-4 shrink-0">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Sources</h3>
                      <p className="text-xs text-slate-500 font-medium">Current connection and schema access</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600">
                        {activeConnection ? activeConnection.name : 'No Connection'}
                      </div>
                      <button onClick={handleNewConnection} className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black">New Connection</button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-10 pb-10 grid grid-cols-12 gap-8">
                    <div className="col-span-6 p-6 bg-white border border-slate-100 rounded-3xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <TableIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold text-slate-700">Tables</span>
                        </div>
                        {activeConnection && (
                          <button
                            onClick={() => {
                              const allSelected = activeConnection.tables.every(t => t.selected);
                              toggleAllTables(activeConnection.id, !allSelected);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                          >
                            {activeConnection.tables.every(t => t.selected) ? 'Clear All' : 'Select All'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                        {activeConnection?.tables.map(table => (
                          <div
                            key={table.name}
                            onClick={() => setSelectedTableName(table.name)}
                            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border transition-all cursor-pointer ${
                              selectedTableName === table.name ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-800">{table.name}</p>
                            </div>
                            <input type="checkbox" checked={table.selected} onChange={() => toggleTable(activeConnection.id, table.name)} className="w-4 h-4 text-blue-600 rounded" />
                          </div>
                        ))}
                        {!activeConnection && <div className="h-full flex items-center justify-center text-slate-400 italic text-sm text-center">Tables will appear here<br/>after connection.</div>}
                      </div>
                    </div>

                    <div className="col-span-6 p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileTextIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold text-slate-700">Schema</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {selectedTableName || 'No table selected'}
                        </span>
                      </div>
                      {activeConnection && selectedTableName ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 max-h-[520px] overflow-y-auto custom-scrollbar">
                          {parseSchemaColumns(
                            activeConnection.tables.find(t => t.name === selectedTableName)?.schema || ''
                          ).map((column, idx) => (
                            <div key={`${selectedTableName}-${idx}`} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                              <span className="text-xs font-semibold text-slate-700 truncate">{column.name}</span>
                              <span className="text-[10px] font-mono text-slate-500 text-right">{column.details}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Select a table to view its schema details.</div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ) : activeTab === 'chat' ? (
            <div className="flex flex-col h-full w-full">
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-4xl mx-auto space-y-12">
                  {!currentConversation || currentConversation.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20">
                      <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl">
                        <DatabaseZapIcon className="w-10 h-10" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">AI Data Studio</h2>
                      <p className="text-slate-500 max-w-md mb-8 text-lg font-medium leading-relaxed">
                        Query your organization's data using plain English. Get instant visualizations.
                      </p>
                      {!activeConnection && (
                        <button onClick={() => setActiveTab('connections')} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                          <PlusIcon className="w-5 h-5" />
                          Set Up Connection First
                        </button>
                      )}
                    </div>
                  ) : (
                    currentConversation.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                          <div className="max-w-[85%] bg-slate-900 text-white rounded-2xl rounded-tr-none px-6 py-4 shadow-xl">
                            <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                          </div>
                        ) : (
                          <AssistantResponse 
                            msg={msg} 
                            selectedModel={selectedModel} 
                            onPin={openExportDialog}
                            onUpdateScheme={updateMessageColorScheme}
                          />
                        )}
                      </div>
                    ))
                  )}
                  {isTyping && <div className="flex justify-start"><div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><Loader2Icon className="w-5 h-5 animate-spin" /></div></div>}
                  <div ref={chatEndRef} />
                </div>
              </div>

              <div className="p-6 bg-white border-t border-slate-200 shrink-0 no-print">
                <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={activeConnection ? `Ask ${activeConnection.database}...` : (excelWorkbook ? 'Ask your Excel data...' : 'Please connect to a database first...')}
                    disabled={!activeConnection && !excelWorkbook}
                    className="w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 focus:bg-white transition-all font-bold text-lg"
                  />
                  <button type="submit" disabled={!userInput.trim() || isTyping || (!activeConnection && !excelWorkbook)} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-30">
                    <SendIcon className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto dashboard-scroll-container">
              {useEnhancedDashboard ? (
                <EnhancedDashboard
                  dashboard={currentDashboard || null}
                  items={currentDashboard?.items || []}
                  title={currentDashboard?.title}
                  onRemove={removeFromDashboard}
                  onUpdateItem={updateDashboardItem}
                  onUpdateLayout={updateDashboardLayout}
                  onRegenerateWidget={handleRegenerateWidget}
                  onUpdateItemScheme={updateDashboardItemColorScheme}
                  onAddItems={appendDashboardItems}
                  dbConnection={isExcelConnection ? null : (activeConnection || null)}
                  apiKey={openAiApiKey}
                  schemaContext={getFullSchemaContext()} // <-- Always pass valid, non-empty schemaContext
                  localExecutor={localExecutor}
                />
              ) : (
                <Dashboard 
                  items={currentDashboard?.items || []} 
                  title={currentDashboard?.title}
                  dashboardId={currentDashboard?.id}
                  onRemove={removeFromDashboard} 
                  onUpdateItemScheme={updateDashboardItemColorScheme} 
                />
              )}
            </div>
          )}
        </main>
      </div>


      {/* Export Dialog */}
      {isExportDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-2xl font-black tracking-tight">Export Widget</h3>
                   <p className="text-sm text-slate-500">Pick destination dashboard</p>
                </div>
                <button onClick={() => setIsExportDialogOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><XIcon className="w-5 h-5 text-slate-400" /></button>
             </div>
             <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               {dashboards.map(d => (
                 <button key={d.id} onClick={() => setSelectedTargetId(d.id)} className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${selectedTargetId === d.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                   <span className="font-bold text-sm">{d.title}</span>
                   {selectedTargetId === d.id && <CheckIcon className="w-4 h-4" />}
                 </button>
               ))}
               <button onClick={() => setSelectedTargetId('new')} className={`w-full p-4 rounded-2xl border border-dashed text-left transition-all ${selectedTargetId === 'new' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'text-slate-400 border-slate-300 hover:border-blue-400 hover:text-blue-600'}`}>+ Create New Dashboard</button>
             </div>
             {selectedTargetId === 'new' && (
               <div className="mb-6 animate-in slide-in-from-top-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">Dashboard Title</label>
                 <input value={exportDashboardName} onChange={e => setExportDashboardName(e.target.value)} placeholder="Enter name..." className="w-full p-4 rounded-2xl border font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500" />
               </div>
             )}
             <button onClick={handleFinalExport} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-900/10">Export to Analysis</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-2xl font-black tracking-tight">Settings</h3>
                   <p className="text-sm text-slate-500">Configure your API keys</p>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><XIcon className="w-5 h-5 text-slate-400" /></button>
             </div>
             
             <div className="space-y-6">
               <div>
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block px-1">OpenAI API Key</label>
                 <input 
                   type="password"
                   value={openAiApiKey} 
                   onChange={e => setOpenAiApiKey(e.target.value)} 
                   placeholder="sk-..." 
                   className="w-full p-4 rounded-2xl border font-mono text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500" 
                 />
                 <p className="text-xs text-slate-400 mt-2 px-1">Your API key is stored locally and never sent to our servers.</p>
               </div>
               
               <button 
                 onClick={() => {
                   localStorage.setItem('sqlmind_openai_key', openAiApiKey);
                   setIsSettingsOpen(false);
                 }} 
                 className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-900/10"
               >
                 Save Settings
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Auto-Dashboard Generator Modal */}
      <AutoDashboardGenerator
        isOpen={isAutoDashboardOpen}
        onClose={() => setIsAutoDashboardOpen(false)}
        onDashboardGenerated={handleAutoDashboardGenerated}
        dbConnection={isExcelConnection ? null : (activeConnection || null)}
        schemaContext={getFullSchemaContext()}
        apiKey={openAiApiKey}
        localExecutor={localExecutor}
      />
    </div>
  );
};

export default App;
