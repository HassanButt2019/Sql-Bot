import React from 'react';
import { DbConnection } from '../../types';
import { CpuIcon, DatabaseIcon, LayoutDashboardIcon, MessageSquareIcon, SettingsIcon, SparklesIcon } from 'lucide-react';

interface AppHeaderProps {
  activeTab: 'chat' | 'dashboard' | 'connections' | 'usage' | 'profile' | 'billing';
  setActiveTab: React.Dispatch<React.SetStateAction<'chat' | 'dashboard' | 'connections' | 'usage' | 'profile' | 'billing'>>;
  activeConnection: DbConnection | undefined;
  openAiApiKey: string;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAutoDashboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  setActiveTab,
  activeConnection,
  openAiApiKey,
  setIsSettingsOpen,
  setIsAutoDashboardOpen
}) => {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 z-40">
      <nav className="flex items-center p-1 bg-slate-100 rounded-xl">
        {['chat', 'dashboard'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'chat' | 'dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
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
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20"
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
  );
};
