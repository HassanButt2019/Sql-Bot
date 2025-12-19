import React, { useState, useEffect, useRef } from 'react';
import { Message, Conversation, DashboardItem, DashboardReport, LLMModel, DbConnection, TableInfo, DbDialect } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SqlChart from './components/SqlChart';
import { queryModel } from './services/llmRouter';
import { introspectDatabase } from './services/introspectionService';
import { 
  SendIcon, 
  TerminalIcon, 
  LayoutDashboardIcon, 
  MessageSquareIcon, 
  ChevronDownIcon, 
  PinIcon, 
  CheckIcon,
  DatabaseIcon,
  Loader2Icon,
  CpuIcon,
  LayersIcon,
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
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard'>('chat');
  
  // Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Dashboard State
  const [dashboards, setDashboards] = useState<DashboardReport[]>([]);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);

  // Connection State
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [connForm, setConnForm] = useState({
    name: '',
    host: '',
    port: '5432',
    user: '',
    password: '',
    database: '',
    dialect: 'postgresql' as DbDialect
  });

  // Export State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [pendingExportMessage, setPendingExportMessage] = useState<Message | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | 'new' | null>(null);
  const [exportDashboardName, setExportDashboardName] = useState('');

  // UI State
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>('gemini-3-pro');
  const [searchQuery, setSearchQuery] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial Load
  useEffect(() => {
    const savedConv = localStorage.getItem('sqlmind_conversations_v3');
    const savedDashboards = localStorage.getItem('sqlmind_dashboards_v3');
    const savedConnections = localStorage.getItem('sqlmind_connections_v3');
    
    if (savedConv) setConversations(JSON.parse(savedConv));
    if (savedDashboards) setDashboards(JSON.parse(savedDashboards));
    if (savedConnections) setConnections(JSON.parse(savedConnections));
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('sqlmind_conversations_v3', JSON.stringify(conversations));
    localStorage.setItem('sqlmind_dashboards_v3', JSON.stringify(dashboards));
    localStorage.setItem('sqlmind_connections_v3', JSON.stringify(connections));
  }, [conversations, dashboards, connections]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentChatId, isTyping]);

  const activeConnection = connections.find(c => c.isActive);
  const currentConversation = conversations.find(c => c.id === currentChatId);
  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);

  const handleConnect = async () => {
    if (!connForm.host || !connForm.database || !connForm.user) return;
    setIsConnecting(true);
    
    try {
      const tables = await introspectDatabase({
        host: connForm.host,
        database: connForm.database,
        username: connForm.user,
        dialect: connForm.dialect
      });

      const newConn: DbConnection = {
        id: Date.now().toString(),
        name: connForm.name || connForm.database,
        host: connForm.host,
        port: connForm.port,
        username: connForm.user,
        database: connForm.database,
        dialect: connForm.dialect,
        tables: tables,
        isActive: true,
        status: 'connected'
      };

      setConnections(prev => prev.map(c => ({...c, isActive: false})).concat(newConn));
      setConnForm({ name: '', host: '', port: '5432', user: '', password: '', database: '', dialect: 'postgresql' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  const getFullSchemaContext = () => {
    if (!activeConnection) return "No schema context available.";
    const selected = activeConnection.tables.filter(t => t.selected);
    if (selected.length === 0) return "No tables selected.";
    return selected.map(t => `TABLE: ${t.name}\nCOLUMNS: ${t.schema}`).join('\n\n');
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isTyping || !activeConnection) return;

    let targetId = currentChatId;
    if (!targetId) {
      const id = Date.now().toString();
      const newConv: Conversation = { id, title: userInput.slice(0, 30) + '...', messages: [], updatedAt: Date.now(), model: selectedModel };
      setConversations([newConv, ...conversations]);
      targetId = id;
      setCurrentChatId(id);
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userInput, timestamp: Date.now() };
    const botMessagePlaceholder: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Analyzing schema...', timestamp: Date.now() };

    setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: [...c.messages, userMessage, botMessagePlaceholder], updatedAt: Date.now() } : c));
    setUserInput('');
    setIsTyping(true);

    try {
      const schemaContext = getFullSchemaContext();
      const result = await queryModel(userMessage.content, schemaContext, selectedModel, (chunkText) => {
        setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, content: chunkText } : m) } : c));
      });
      
      setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, ...result, content: result.content || "Report generated." } : m) } : c));
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleTable = (connId: string, tableName: string) => {
    setConnections(prev => prev.map(conn => conn.id === connId ? { ...conn, tables: conn.tables.map(t => t.name === tableName ? { ...t, selected: !t.selected } : t) } : conn));
  };

  const deleteConnection = (id: string) => {
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

  const openExportDialog = (message: Message) => {
    setPendingExportMessage(message);
    setSelectedTargetId(currentDashboardId || (dashboards.length > 0 ? dashboards[0].id : 'new'));
    setIsExportDialogOpen(true);
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
    const newItem: DashboardItem = { id: Date.now().toString(), title: pendingExportMessage.chartConfig.title, chartConfig: { ...pendingExportMessage.chartConfig }, chartData: JSON.parse(JSON.stringify(pendingExportMessage.chartData)), addedAt: Date.now(), colSpan: 6, height: 350 };
    updatedDashboards = updatedDashboards.map(d => d.id === targetId ? { ...d, items: [newItem, ...d.items], updatedAt: Date.now() } : d);
    setDashboards(updatedDashboards);
    setIsExportDialogOpen(false);
    setPendingExportMessage(null);
    setCurrentDashboardId(targetId);
    setActiveTab('dashboard');
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <Sidebar 
        mode={activeTab}
        items={(activeTab === 'chat' ? conversations : dashboards).filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))}
        currentId={activeTab === 'chat' ? currentChatId : currentDashboardId}
        onSelect={activeTab === 'chat' ? setCurrentChatId : setCurrentDashboardId}
        onNew={() => activeTab === 'chat' ? setCurrentChatId(null) : {}}
        onDelete={(id) => activeTab === 'chat' ? setConversations(c => c.filter(x => x.id !== id)) : setDashboards(d => d.filter(x => x.id !== id))}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
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
            {activeTab === 'chat' && (
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-50">
                  <CpuIcon className={`w-4 h-4 text-blue-500`} />
                  {selectedModel.replace('-', ' ')}
                  <ChevronDownIcon className="w-3.5 h-3.5 opacity-40" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all overflow-hidden z-50">
                   {['gemini-3-pro', 'gemini-3-flash', 'claude-3-5', 'gpt-4o'].map(m => (
                     <button key={m} onClick={() => setSelectedModel(m as LLMModel)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-700">{m}</button>
                   ))}
                </div>
              </div>
            )}
            <button 
              onClick={() => setIsDbModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black shadow-lg shadow-slate-900/10"
            >
              <DatabaseIcon className={`w-3.5 h-3.5 ${activeConnection ? 'text-green-400' : 'text-slate-400'}`} />
              <span className="max-w-[120px] truncate">{activeConnection ? activeConnection.database : 'Connect DB'}</span>
              <SettingsIcon className="w-3.5 h-3.5 ml-1 opacity-40" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'chat' ? (
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
                        <button onClick={() => setIsDbModalOpen(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
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
                    placeholder={activeConnection ? `Ask ${activeConnection.database}...` : "Please connect to a database first..."}
                    disabled={!activeConnection}
                    className="w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 focus:bg-white transition-all font-bold text-lg"
                  />
                  <button type="submit" disabled={!userInput.trim() || isTyping || !activeConnection} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-30">
                    <SendIcon className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto dashboard-scroll-container">
              <Dashboard 
                items={currentDashboard?.items || []} 
                title={currentDashboard?.title} 
                onRemove={removeFromDashboard} 
                onUpdateSize={updateDashboardItemSize} 
                onUpdateItemScheme={updateDashboardItemColorScheme} 
              />
            </div>
          )}
        </main>
      </div>

      {/* Connection Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden flex h-[85vh] animate-in zoom-in-95">
            <div className="w-[300px] bg-slate-50 border-r border-slate-200 p-8 flex flex-col shrink-0">
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white"><ServerIcon className="w-4 h-4" /></div>
                  <h3 className="font-black text-lg tracking-tight">Saved Sources</h3>
               </div>
               <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                 {connections.map(c => (
                   <div key={c.id} onClick={() => setConnections(prev => prev.map(x => ({...x, isActive: x.id === c.id})))} className={`p-4 rounded-2xl border cursor-pointer transition-all ${c.isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm truncate">{c.name}</span>
                        {c.isActive && <CheckIcon className="w-4 h-4" />}
                      </div>
                      <p className={`text-[10px] truncate opacity-60 font-mono`}>{c.host}</p>
                      <div className="mt-3 flex items-center justify-between">
                         <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${c.isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{c.dialect}</span>
                         <button onClick={(e) => { e.stopPropagation(); deleteConnection(c.id); }} className="p-1 hover:text-red-500"><Trash2Icon className="w-3 h-3" /></button>
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
               <div className="flex items-center justify-between p-10 pb-4 shrink-0">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Connection Manager</h3>
                    <p className="text-slate-500 font-medium italic">Configure credentials & Select tables for analysis</p>
                  </div>
                  <button onClick={() => setIsDbModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400"><XIcon /></button>
               </div>

               <div className="flex-1 overflow-y-auto p-10 grid grid-cols-2 gap-12">
                  <div className="space-y-6">
                     <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                           <GlobeIcon className="w-4 h-4 text-blue-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Database Credentials</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <input value={connForm.host} onChange={e => setConnForm({...connForm, host: e.target.value})} placeholder="Host" className="w-full p-3 rounded-xl border text-sm font-semibold" />
                           <input value={connForm.port} onChange={e => setConnForm({...connForm, port: e.target.value})} placeholder="Port" className="w-full p-3 rounded-xl border text-sm font-semibold" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <input value={connForm.user} onChange={e => setConnForm({...connForm, user: e.target.value})} placeholder="User" className="w-full p-3 rounded-xl border text-sm font-semibold" />
                           <input type="password" value={connForm.password} onChange={e => setConnForm({...connForm, password: e.target.value})} placeholder="Password" className="w-full p-3 rounded-xl border text-sm font-semibold" />
                        </div>
                        <input value={connForm.database} onChange={e => setConnForm({...connForm, database: e.target.value})} placeholder="Database Name" className="w-full p-3 rounded-xl border text-sm font-semibold" />
                        <select value={connForm.dialect} onChange={e => setConnForm({...connForm, dialect: e.target.value as DbDialect})} className="w-full p-3 rounded-xl border text-sm font-semibold bg-white">
                           <option value="postgresql">PostgreSQL</option>
                           <option value="mysql">MySQL</option>
                           <option value="sqlserver">SQL Server</option>
                           <option value="sqlite">SQLite</option>
                        </select>
                        <button onClick={handleConnect} disabled={isConnecting} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2">
                           {isConnecting ? <><Loader2Icon className="w-4 h-4 animate-spin" /> Verifying...</> : <><ArrowRightIcon className="w-4 h-4" /> Connect & Introspect</>}
                        </button>
                     </div>
                     <div className="p-6 bg-slate-950 rounded-3xl text-white space-y-3">
                        <div className="flex items-center gap-3">
                           <ShieldCheckIcon className="w-4 h-4 text-green-400" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Note</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">Schema extraction is performed locally. Data records are NOT sent to the AI, only metadata.</p>
                     </div>
                  </div>

                  <div className="flex flex-col min-h-0">
                     <div className="mb-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schema Discovery</span>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">{activeConnection?.database || 'No Schema Found'}</h4>
                     </div>
                     <div className="flex-1 overflow-y-auto space-y-3 pr-4 custom-scrollbar">
                        {activeConnection?.tables.map(table => (
                          <div key={table.name} onClick={() => toggleTable(activeConnection.id, table.name)} className={`p-4 rounded-[2rem] border cursor-pointer transition-all ${table.selected ? 'bg-white border-blue-500 shadow-xl' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                             <div className="flex items-center justify-between mb-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${table.selected ? 'bg-blue-600 text-white' : 'bg-white border text-slate-400'}`}><TableIcon className="w-4 h-4" /></div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${table.selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{table.selected && <CheckIcon className="w-3 h-3 text-white" />}</div>
                             </div>
                             <p className={`font-black text-xs mb-1 ${table.selected ? 'text-slate-900' : 'text-slate-500'}`}>{table.name}</p>
                             <p className="text-[10px] text-slate-400 font-mono truncate">{table.schema}</p>
                          </div>
                        ))}
                        {!activeConnection && <div className="h-full flex items-center justify-center text-slate-400 italic text-sm text-center">Tables will appear here<br/>after connection.</div>}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default App;