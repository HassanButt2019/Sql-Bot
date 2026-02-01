import React, { useState, useEffect, useRef } from 'react';
import { Message, Conversation, DashboardItem, DashboardReport, LLMModel, DbConnection, DbDialect } from './types';
import Sidebar from './components/Sidebar';
import BillingPage from './components/BillingPage';
import { AppHeader } from './components/layout/AppHeader';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import Dashboard from './components/Dashboard';
import EnhancedDashboard from './components/EnhancedDashboard';
import SqlChart from './components/SqlChart';
import AutoDashboardGenerator from './components/AutoDashboardGenerator';
import SemanticReviewPanel from './components/SemanticReviewPanel';
import { loadPersistedConnections, loadPersistedConversations, loadPersistedDashboards, savePersistedAppState } from './services/appPersistence';
import { useExcelWorkbook } from './hooks/useExcelWorkbook';
import { useConnections } from './hooks/useConnections';
import { useIntegrations } from './hooks/useIntegrations';
import { useChat } from './hooks/useChat';
import { useDashboard } from './hooks/useDashboard';
import { requestSemanticAgent } from './services/semanticService';
import { buildDbConnectionInfo } from './services/dbConnectionInfo';
import { initErrorReporting } from './services/errorReporting';
import UsageAdminPage from './components/UsageAdminPage';
import ProfilePage from './components/ProfilePage';
import AuthScreen from './components/AuthScreen';
import { clearAuthToken, fetchCurrentUser } from './services/authService';
import { 
  SendIcon, 
  TerminalIcon, 
  PinIcon, 
  CheckIcon,
  Loader2Icon,
  CpuIcon,
  XIcon,
  PlusIcon,
  Edit3Icon,
  ServerIcon,
  TableIcon,
  Trash2Icon,
  DatabaseZapIcon,
  GlobeIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  FileTextIcon,
  Code2Icon,
  BarChart3Icon
} from 'lucide-react';


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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!hasSql ? 'opacity-30 cursor-not-allowed' : activeTab === 'sql' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                  <pre className="p-8 text-sm font-mono text-blue-300 leading-relaxed whitespace-pre-wrap selection:bg-blue-500/40">
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
                    <PinIcon className="w-3.5 h-3.5 text-blue-600" />
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

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
};

const parseSchemaTables = (schema: string) => {
  if (!schema) return [];
  const blocks = schema.split(/\n\s*\n/);
  const tables: { name: string }[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const tableLine = lines.find(line => line.startsWith('TABLE:'));
    if (!tableLine) continue;
    const name = tableLine.replace('TABLE:', '').trim();
    if (name) tables.push({ name });
  }
  return tables;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'connections' | 'usage' | 'profile' | 'billing'>('chat');
  const [dataSourcesTab, setDataSourcesTab] = useState<'manage' | 'add'>('manage');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
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

  const [searchQuery, setSearchQuery] = useState('');
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openAiApiKey, setOpenAiApiKey] = useState(() => localStorage.getItem('sqlmind_openai_key') || import.meta.env.VITE_OPENAI_API_KEY || '');
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const {
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
  } = useIntegrations({ setConnections, userId: currentUser?.id });

  const {
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
  } = useExcelWorkbook({
    setConnections,
    setIntegrationStatuses,
    setIntegrationHistory
  });

  const {
    activeConnection,
    isExcelConnection,
    localExecutor,
    handleConnect,
    toggleTable,
    toggleAllTables,
    deleteConnection,
    getFullSchemaContext
  } = useConnections({
    connections,
    setConnections,
    connForm,
    setConnForm,
    useConnectionString,
    setConnectionError,
    setIsConnecting,
    excelWorkbook,
    setExcelWorkbook,
    setExcelActiveSheetId
  });

  const {
    dashboards,
    setDashboards,
    currentDashboardId,
    setCurrentDashboardId,
    currentDashboard,
    isExportDialogOpen,
    setIsExportDialogOpen,
    pendingExportMessage,
    selectedTargetId,
    setSelectedTargetId,
    exportDashboardName,
    setExportDashboardName,
    isAutoDashboardOpen,
    setIsAutoDashboardOpen,
    useEnhancedDashboard,
    updateDashboardItemColorScheme,
    removeFromDashboard,
    updateDashboardItem,
    updateDashboardLayout,
    appendDashboardItems,
    handleRegenerateWidget,
    openExportDialog,
    handleAutoDashboardGenerated,
    handleFinalExport
  } = useDashboard({
    initialDashboards: [],
    setActiveTab,
    openAiApiKey,
    activeConnection,
    isExcelConnection,
    localExecutor,
    getFullSchemaContext
  });

  const schemaContext = getFullSchemaContext();
  const semanticSchemaHashRef = useRef<string>('');

  useEffect(() => {
    if (!schemaContext || !schemaContext.trim()) return;

    const nextHash = hashString(schemaContext);
    if (semanticSchemaHashRef.current === nextHash) return;

    semanticSchemaHashRef.current = nextHash;
    const sourceId = activeConnection?.id || (excelWorkbook ? 'excel-local' : 'unknown');
    const sourceType = isExcelConnection ? 'excel' : (activeConnection ? 'sql' : 'unknown');
    const dbConnectionInfo = !isExcelConnection && activeConnection ? buildDbConnectionInfo(activeConnection) : null;

    const runAgent = async () => {
      let profileData: Record<string, any> | undefined;

      if (isExcelConnection && localExecutor) {
        const tables = parseSchemaTables(schemaContext).slice(0, 4);
        const tableProfiles = [];
        for (const table of tables) {
          try {
            const rows = await localExecutor(`SELECT * FROM "${table.name}" LIMIT 5`);
            const columnStats: Record<string, any> = {};
            for (const row of rows || []) {
              for (const [key, value] of Object.entries(row || {})) {
                if (!columnStats[key]) {
                  columnStats[key] = { nonNull: 0, distinct: new Set<string>(), examples: [] as any[] };
                }
                if (value !== null && value !== undefined && value !== '') {
                  columnStats[key].nonNull += 1;
                  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
                  if (!columnStats[key].distinct.has(serialized) && columnStats[key].examples.length < 3) {
                    columnStats[key].examples.push(value);
                  }
                  columnStats[key].distinct.add(serialized);
                }
              }
            }
            const normalizedStats: Record<string, any> = {};
            for (const [key, stat] of Object.entries(columnStats)) {
              normalizedStats[key] = {
                nonNull: stat.nonNull,
                distinct: stat.distinct.size,
                examples: stat.examples
              };
            }
            tableProfiles.push({
              name: table.name,
              sampleRows: rows || [],
              columnStats: normalizedStats
            });
          } catch {
            tableProfiles.push({ name: table.name, sampleRows: [], columnStats: {} });
          }
        }
        profileData = { tables: tableProfiles };
      }

      await requestSemanticAgent({
        schemaContext,
        apiKey: openAiApiKey?.trim() || undefined,
        sourceId,
        sourceType,
        dbConnection: dbConnectionInfo,
        profileData
      });
    };

    runAgent().catch(() => null);
  }, [schemaContext, openAiApiKey, activeConnection?.id, excelWorkbook, isExcelConnection, localExecutor, activeConnection]);

  // LLM Model - fixed to GPT-4o
  const selectedModel: LLMModel = 'gpt-4o';

  const {
    userInput,
    setUserInput,
    isTyping,
    currentConversation,
    chatEndRef,
    scrollToBottom,
    handleSendMessage,
    updateMessageColorScheme
  } = useChat({
    conversations,
    setConversations,
    currentChatId,
    setCurrentChatId,
    activeConnection,
    excelWorkbook,
    isExcelConnection,
    localExecutor,
    openAiApiKey,
    setIsSettingsOpen,
    setActiveTab,
    getFullSchemaContext
  });

  // Initial Load
  useEffect(() => {
    if (!currentUser?.id) return;
    const savedConversations = loadPersistedConversations(currentUser.id);
    const savedDashboards = loadPersistedDashboards(currentUser.id);
    const savedConnections = loadPersistedConnections(currentUser.id);

    setConversations(savedConversations);
    setDashboards(savedDashboards);
    setConnections(savedConnections);
    setCurrentChatId(savedConversations[0]?.id || null);
    setCurrentDashboardId(savedDashboards[0]?.id || null);
  }, [currentUser?.id]);

  useEffect(() => {
    initErrorReporting();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetchCurrentUser();
        if (res.success && res.data?.user) {
          setCurrentUser(res.data.user);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    loadUser();
  }, []);


  // Persistence
  useEffect(() => {
    if (!currentUser?.id) return;
    savePersistedAppState(conversations, dashboards, connections, currentUser.id);
  }, [conversations, dashboards, connections, currentUser?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, currentChatId, isTyping, scrollToBottom]);

  useEffect(() => {
    if (!activeConnection || !activeConnection.tables.length) {
      setSelectedTableName(null);
      return;
    }
    if (!selectedTableName || !activeConnection.tables.some(t => t.name === selectedTableName)) {
      setSelectedTableName(activeConnection.tables[0].name);
    }
  }, [activeConnection, selectedTableName]);

  const handleNewConnection = () => {
    setConnForm({ name: '', host: '', port: '5432', user: '', password: '', database: '', dialect: 'postgresql', connectionString: '' });
    setConnectionError(null);
    setActiveTab('connections');
    setDataSourcesTab('add');
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

  if (!authChecked) {
    return <div className="h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!currentUser) {
    return <AuthScreen onAuthenticated={(user) => setCurrentUser(user)} />;
  }

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
        onNavigateUsage={() => setActiveTab('usage')}
        onNavigateBilling={() => setActiveTab('billing')}
        onNavigateProfile={() => setActiveTab('profile')}
        onNavigateHome={() => setActiveTab('chat')}
        user={currentUser}
        onLogout={() => {
          clearAuthToken();
          setConversations([]);
          setDashboards([]);
          setConnections([]);
          setCurrentChatId(null);
          setCurrentDashboardId(null);
          setCurrentUser(null);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <AppHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeConnection={activeConnection}
          openAiApiKey={openAiApiKey}
          setIsSettingsOpen={setIsSettingsOpen}
          setIsAutoDashboardOpen={setIsAutoDashboardOpen}
        />

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'usage' ? (
            <UsageAdminPage />
          ) : activeTab === 'billing' ? (
            <BillingPage />
          ) : activeTab === 'profile' ? (
            <ProfilePage
              user={currentUser}
              onUpdate={(user) => setCurrentUser(user)}
            />
          ) : activeTab === 'connections' ? (
            <div className="h-full overflow-y-auto p-8">
              <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[80vh]">
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4 px-10 pt-8 pb-4 shrink-0">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Sources</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Add a source or manage selected tables for the active connection.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600">
                        {activeConnection ? activeConnection.name : 'No Connection'}
                      </div>
                      <button
                        onClick={() => setDataSourcesTab('add')}
                        className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black"
                      >
                        Add Source
                      </button>
                    </div>
                  </div>

                  <div className="px-10 pb-4">
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
                      <button
                        onClick={() => setDataSourcesTab('manage')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          dataSourcesTab === 'manage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Manage Sources
                      </button>
                      <button
                        onClick={() => setDataSourcesTab('add')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          dataSourcesTab === 'add' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Add Source
                      </button>
                    </div>
                  </div>

                  {dataSourcesTab === 'add' ? (
                    <div className="flex-1 overflow-y-auto px-6 pb-8">
                      <IntegrationsPanel
                        integrationCategory={integrationCategory}
                        setIntegrationCategory={setIntegrationCategory}
                        integrationSearch={integrationSearch}
                        setIntegrationSearch={setIntegrationSearch}
                        integrationHistory={integrationHistory}
                        analyticsIntegrationIds={analyticsIntegrationIds}
                        setAnalyticsIntegrationIds={setAnalyticsIntegrationIds}
                        integrations={integrations}
                        integrationStatuses={integrationStatuses}
                        selectedIntegrationId={selectedIntegrationId}
                        setSelectedIntegrationId={setSelectedIntegrationId}
                        integrationUseUrl={integrationUseUrl}
                        setIntegrationUseUrl={setIntegrationUseUrl}
                        integrationUrlForm={integrationUrlForm}
                        setIntegrationUrlForm={setIntegrationUrlForm}
                        integrationFields={integrationFields}
                        integrationRelationalForm={integrationRelationalForm}
                        setIntegrationRelationalForm={setIntegrationRelationalForm}
                        integrationIsConnecting={integrationIsConnecting}
                        integrationError={integrationError}
                        integrationTables={integrationTables}
                        integrationSelectedTableName={integrationSelectedTableName}
                        setIntegrationSelectedTableName={setIntegrationSelectedTableName}
                        toggleIntegrationTable={toggleIntegrationTable}
                        toggleAllIntegrationTables={toggleAllIntegrationTables}
                        parseSchemaColumns={parseSchemaColumns}
                        handleIntegrationTest={handleIntegrationTest}
                        handleIntegrationSave={handleIntegrationSave}
                        excelWorkbook={excelWorkbook}
                        excelIsLoading={excelIsLoading}
                        excelError={excelError}
                        activeExcelSheet={activeExcelSheet}
                        setExcelActiveSheetId={setExcelActiveSheetId}
                        handleExcelUpload={handleExcelUpload}
                        toggleExcelSheet={toggleExcelSheet}
                        renameExcelColumn={renameExcelColumn}
                        toggleExcelColumn={toggleExcelColumn}
                      />
                    </div>
                  ) : (
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

                      <div className="col-span-12">
                        <SemanticReviewPanel
                          schemaContext={schemaContext}
                          sourceId={activeConnection?.id || (excelWorkbook ? 'excel-local' : 'unknown')}
                        />
                      </div>
                    </div>
                  )}

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
                  schemaContext={schemaContext} // <-- Always pass valid, non-empty schemaContext
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
        schemaContext={schemaContext}
        apiKey={openAiApiKey}
        localExecutor={localExecutor}
      />
    </div>
  );
};

export default App;
