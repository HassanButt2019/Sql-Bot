
import React, { useState, useEffect, useRef } from 'react';
import { Message, Conversation, DashboardItem, DashboardReport, LLMModel } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SqlChart from './components/SqlChart';
import { queryModel } from './services/llmRouter';
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
  Edit3Icon
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard'>('chat');
  
  // Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Dashboard State
  const [dashboards, setDashboards] = useState<DashboardReport[]>([]);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);

  // Export Dialog State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [pendingExportMessage, setPendingExportMessage] = useState<Message | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | 'new' | null>(null);
  const [exportDashboardName, setExportDashboardName] = useState('');

  // Search/Input
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>('gemini-3-pro');
  const [searchQuery, setSearchQuery] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial Load
  useEffect(() => {
    const savedConv = localStorage.getItem('sqlmind_conversations_v2');
    const savedDashboards = localStorage.getItem('sqlmind_dashboards_v2');
    
    if (savedConv) {
      const parsed = JSON.parse(savedConv);
      setConversations(parsed);
      if (parsed.length > 0) setCurrentChatId(parsed[0].id);
    }
    
    if (savedDashboards) {
      const parsed = JSON.parse(savedDashboards);
      setDashboards(parsed);
      if (parsed.length > 0) {
        setCurrentDashboardId(parsed[0].id);
      }
    } else {
      const defaultId = Date.now().toString();
      const defaultDash: DashboardReport = {
        id: defaultId,
        title: 'Main Dashboard',
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setDashboards([defaultDash]);
      setCurrentDashboardId(defaultId);
    }
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('sqlmind_conversations_v2', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('sqlmind_dashboards_v2', JSON.stringify(dashboards));
  }, [dashboards]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentChatId, isTyping]);

  const currentConversation = conversations.find(c => c.id === currentChatId);
  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);

  const startNewChat = () => {
    const id = Date.now().toString();
    const newConv: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
      model: selectedModel
    };
    setConversations([newConv, ...conversations]);
    setCurrentChatId(id);
    setActiveTab('chat');
  };

  const startNewDashboard = () => {
    const id = Date.now().toString();
    const newDash: DashboardReport = {
      id,
      title: 'New Dashboard ' + (dashboards.length + 1),
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setDashboards([newDash, ...dashboards]);
    setCurrentDashboardId(id);
    setActiveTab('dashboard');
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isTyping) return;

    let targetId = currentChatId;
    if (!targetId) {
      const id = Date.now().toString();
      const newConv: Conversation = {
        id,
        title: userInput.slice(0, 30) + '...',
        messages: [],
        updatedAt: Date.now(),
        model: selectedModel
      };
      setConversations([newConv, ...conversations]);
      targetId = id;
      setCurrentChatId(id);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    };

    const botMessagePlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Analysing database structure...',
      timestamp: Date.now()
    };

    setConversations(prev => prev.map(c => 
      c.id === targetId 
        ? { ...c, messages: [...c.messages, userMessage, botMessagePlaceholder], updatedAt: Date.now(), title: c.messages.length === 0 ? userInput.slice(0, 30) + '...' : c.title }
        : c
    ));

    setUserInput('');
    setIsTyping(true);

    try {
      const result = await queryModel(userMessage.content, selectedModel, (chunkText) => {
        setConversations(prev => prev.map(c => 
          c.id === targetId 
            ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, content: chunkText } : m) }
            : c
        ));
      });
      
      setConversations(prev => prev.map(c => 
        c.id === targetId 
          ? { 
              ...c, 
              messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { 
                ...m, 
                content: result.content || "Report generated.",
                sql: result.sql,
                explanation: result.explanation,
                chartData: result.chartData,
                chartConfig: result.chartConfig
              } : m)
            }
          : c
      ));
    } catch (error) {
      console.error(error);
      setConversations(prev => prev.map(c => 
        c.id === targetId ? { 
          ...c, 
          messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { 
            ...m, 
            content: "Error connecting to model provider." 
          } : m)
        } : c
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const openExportDialog = (message: Message) => {
    setPendingExportMessage(message);
    setSelectedTargetId(currentDashboardId || (dashboards.length > 0 ? dashboards[0].id : 'new'));
    const initialDash = dashboards.find(d => d.id === currentDashboardId) || dashboards[0];
    setExportDashboardName(initialDash?.title || '');
    setIsExportDialogOpen(true);
  };

  const handleFinalExport = () => {
    if (!pendingExportMessage?.chartConfig || !pendingExportMessage?.chartData) return;
    if (!exportDashboardName.trim()) return;

    let targetId = selectedTargetId;
    let updatedDashboards = [...dashboards];

    if (targetId === 'new') {
      const newId = Date.now().toString();
      const newDash: DashboardReport = {
        id: newId,
        title: exportDashboardName.trim(),
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      updatedDashboards = [newDash, ...dashboards];
      targetId = newId;
    } else {
      updatedDashboards = updatedDashboards.map(d => 
        d.id === targetId ? { ...d, title: exportDashboardName.trim(), updatedAt: Date.now() } : d
      );
    }

    const newItem: DashboardItem = {
      id: (Date.now() + 1).toString(),
      title: pendingExportMessage.chartConfig.title,
      chartConfig: pendingExportMessage.chartConfig,
      chartData: pendingExportMessage.chartData,
      addedAt: Date.now(),
      colSpan: 6,
      height: 350
    };

    updatedDashboards = updatedDashboards.map(d => 
      d.id === targetId 
        ? { ...d, items: [newItem, ...d.items], updatedAt: Date.now() } 
        : d
    );

    setDashboards(updatedDashboards);
    setIsExportDialogOpen(false);
    setPendingExportMessage(null);
    setCurrentDashboardId(targetId);
    setActiveTab('dashboard');
  };

  const removeFromDashboard = (id: string) => {
    setDashboards(prev => prev.map(d => 
      d.id === currentDashboardId 
        ? { ...d, items: d.items.filter(item => item.id !== id), updatedAt: Date.now() } 
        : d
    ));
  };

  const toggleResize = (id: string) => {
    setDashboards(prev => prev.map(d => 
      d.id === currentDashboardId 
        ? { 
            ...d, 
            items: d.items.map(item => {
              if (item.id !== id) return item;
              let newColSpan: DashboardItem['colSpan'] = 6;
              let newHeight = 350;
              if (item.colSpan === 6) { newColSpan = 4; newHeight = 300; }
              else if (item.colSpan === 4) { newColSpan = 12; newHeight = 450; }
              else { newColSpan = 6; newHeight = 350; }
              return { ...item, colSpan: newColSpan, height: newHeight };
            }),
            updatedAt: Date.now()
          } 
        : d
    ));
  };

  const deleteConversation = (id: string) => {
    setConversations(conversations.filter(c => c.id !== id));
    if (currentChatId === id) setCurrentChatId(conversations.find(c => c.id !== id)?.id || null);
  };

  const deleteDashboard = (id: string) => {
    if (dashboards.length <= 1) return;
    setDashboards(dashboards.filter(d => d.id !== id));
    if (currentDashboardId === id) setCurrentDashboardId(dashboards.find(d => d.id !== id)?.id || null);
  };

  const filteredItems = (activeTab === 'chat' ? conversations : dashboards).filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <Sidebar 
        mode={activeTab}
        items={filteredItems}
        currentId={activeTab === 'chat' ? currentChatId : currentDashboardId}
        onSelect={activeTab === 'chat' ? setCurrentChatId : setCurrentDashboardId}
        onNew={activeTab === 'chat' ? startNewChat : startNewDashboard}
        onDelete={activeTab === 'chat' ? deleteConversation : deleteDashboard}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 z-30 shrink-0 no-print">
          <div className="flex items-center gap-6">
            <nav className="flex items-center p-1 bg-slate-100/50 rounded-xl">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <MessageSquareIcon className="w-4 h-4" />
                Discovery
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutDashboardIcon className="w-4 h-4" />
                Analysis
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'chat' && (
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
                  <CpuIcon className={`w-4 h-4 ${selectedModel.includes('gpt') ? 'text-green-500' : 'text-blue-500'}`} />
                  {selectedModel.toUpperCase()}
                  <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-40 overflow-hidden">
                  {['gemini-3-pro', 'gemini-3-flash', 'claude-3-5', 'gpt-4o'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m as LLMModel)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700"
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-widest">
              <DatabaseIcon className="w-3.5 h-3.5 text-green-400" />
              Connected
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative bg-[#f8fafc]">
          {activeTab === 'chat' ? (
            <div className="flex flex-col h-full w-full">
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-4xl mx-auto space-y-12">
                  {!currentConversation || currentConversation.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20">
                      <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-blue-500/10">
                        <TerminalIcon className="w-10 h-10" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">AI Data Studio</h2>
                      <p className="text-slate-500 max-w-md mb-12 text-lg font-medium leading-relaxed">
                        Query your organization's data using plain language. Get SQL, visual reports, and insights instantly.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        {[
                          "Quarterly revenue by region and product",
                          "Top 5 customers with high churn risk",
                          "Daily order volume trend last 30 days",
                          "Stock levels vs Average monthly demand"
                        ].map((example) => (
                          <button
                            key={example}
                            onClick={() => setUserInput(example)}
                            className="p-6 text-sm text-left bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-2xl hover:-translate-y-1 transition-all text-slate-700 group flex items-start gap-4"
                          >
                            <LayersIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="font-bold tracking-tight">"{example}"</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {currentConversation.messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'user' ? (
                            <div className="max-w-[85%] bg-slate-900 text-white rounded-2xl rounded-tr-none px-6 py-4 shadow-xl">
                              <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                            </div>
                          ) : (
                            <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                              <div className="flex gap-6 items-start">
                                <div className={`w-12 h-12 rounded-2xl ${selectedModel.includes('gpt') ? 'bg-green-600' : 'bg-blue-600'} flex items-center justify-center text-white shrink-0 shadow-xl shadow-blue-500/20`}>
                                  <CpuIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 space-y-8 min-w-0">
                                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                    <p className="text-lg text-slate-800 leading-relaxed font-semibold tracking-tight">
                                      {msg.content}
                                    </p>
                                  </div>

                                  {msg.sql && (
                                    <div className="bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                                      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800">
                                        <div className="flex items-center gap-3">
                                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Generated SQL Logic</span>
                                        </div>
                                        <button className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800 rounded-xl">
                                          <CheckIcon className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <div className="max-h-[400px] overflow-y-auto">
                                        <pre className="p-8 text-sm font-mono text-indigo-300 leading-relaxed selection:bg-indigo-500/40 whitespace-pre-wrap">
                                          {msg.sql}
                                        </pre>
                                      </div>
                                    </div>
                                  )}

                                  {msg.chartConfig && msg.chartData && (
                                    <div className="relative group/chart">
                                      <div className="absolute top-8 right-8 z-10 opacity-0 group-hover/chart:opacity-100 transition-all scale-95 group-hover/chart:scale-100">
                                        <button
                                          onClick={() => openExportDialog(msg)}
                                          className="flex items-center gap-2 bg-white/95 backdrop-blur-xl text-slate-900 text-xs font-black px-6 py-3 rounded-2xl shadow-2xl border border-slate-200 hover:bg-white transition-all active:scale-95"
                                        >
                                          <PinIcon className="w-4 h-4 text-indigo-600" />
                                          EXPORT TO DASHBOARD
                                        </button>
                                      </div>
                                      <SqlChart
                                        type={msg.chartConfig.type}
                                        data={msg.chartData}
                                        xAxis={msg.chartConfig.xAxis}
                                        yAxis={msg.chartConfig.yAxis}
                                        title={msg.chartConfig.title}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="flex gap-6 w-full">
                              <div className={`w-12 h-12 rounded-2xl ${selectedModel.includes('gpt') ? 'bg-green-600' : 'bg-blue-600'} flex items-center justify-center text-white shrink-0 shadow-xl`}>
                                <Loader2Icon className="w-6 h-6 animate-spin" />
                              </div>
                              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 w-full shadow-sm animate-pulse flex flex-col gap-5">
                                <div className="h-4 bg-slate-100 rounded-full w-4/5"></div>
                                <div className="h-4 bg-slate-100 rounded-full w-2/3"></div>
                              </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </>
                  )}
                </div>
              </div>

              <div className="p-6 bg-white border-t border-slate-200 shrink-0 no-print">
                <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <TerminalIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={`Ask anything about your data...`}
                    className="w-full pl-16 pr-16 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all shadow-sm text-lg font-bold tracking-tight"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isTyping}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3.5 bg-blue-600 text-white rounded-[1.25rem] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                  >
                    <SendIcon className="w-6 h-6" />
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
                onResize={toggleResize}
              />
            </div>
          )}
        </main>
      </div>

      {isExportDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300 no-print">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Export Visual</h3>
                <p className="text-sm text-slate-500 font-medium">Choose or create a target dashboard</p>
              </div>
              <button 
                onClick={() => setIsExportDialogOpen(false)} 
                className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Target Dashboard</label>
                <div className="max-h-[240px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {dashboards.map((dash) => (
                    <button
                      key={dash.id}
                      onClick={() => {
                        setSelectedTargetId(dash.id);
                        setExportDashboardName(dash.title);
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all group text-left ${
                        selectedTargetId === dash.id 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                          : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          selectedTargetId === dash.id ? 'bg-indigo-500 text-white' : 'bg-white border border-slate-200 text-slate-400'
                        }`}>
                          <LayoutDashboardIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-bold text-sm tracking-tight ${selectedTargetId === dash.id ? 'text-white' : 'text-slate-900'}`}>{dash.title}</p>
                          <p className={`text-[10px] uppercase font-black tracking-widest ${selectedTargetId === dash.id ? 'text-indigo-200' : 'text-slate-400'}`}>{dash.items.length} WIDGETS</p>
                        </div>
                      </div>
                      {selectedTargetId === dash.id && <CheckIcon className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => {
                      setSelectedTargetId('new');
                      setExportDashboardName('');
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed transition-all font-bold text-sm text-left ${
                      selectedTargetId === 'new'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      selectedTargetId === 'new' ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-300'
                    }`}>
                      <PlusIcon className="w-5 h-5" />
                    </div>
                    <span>Create New Dashboard</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  {selectedTargetId === 'new' ? 'New Dashboard Name' : 'Edit Dashboard Title'}
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Edit3Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <input 
                    type="text"
                    value={exportDashboardName}
                    onChange={(e) => setExportDashboardName(e.target.value)}
                    placeholder={selectedTargetId === 'new' ? "Enter dashboard name..." : "Dashboard title..."}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 focus:bg-white transition-all font-bold text-slate-900"
                  />
                </div>
              </div>

              <button 
                onClick={handleFinalExport}
                disabled={!exportDashboardName.trim()}
                className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                {selectedTargetId === 'new' ? 'Create & Export Visual' : 'Export Visual & Update Title'}
              </button>

              <button 
                onClick={() => setIsExportDialogOpen(false)}
                className="w-full py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
