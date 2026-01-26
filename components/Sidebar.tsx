
import React from 'react';
import { Conversation, DashboardReport, DbConnection } from '../types';
import { 
  PlusIcon, 
  SearchIcon, 
  MessageSquareIcon, 
  Trash2Icon, 
  MoreVerticalIcon,
  CalendarIcon,
  LayoutDashboardIcon,
  DatabaseIcon
} from 'lucide-react';

interface SidebarProps {
  mode: 'chat' | 'dashboard' | 'connections' | 'usage' | 'profile' | 'billing';
  items: (Conversation | DashboardReport | DbConnection)[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onNavigateUsage: () => void;
  onNavigateBilling: () => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
  user?: { name?: string; email?: string; role?: string };
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  mode,
  items, 
  currentId, 
  onSelect, 
  onNew, 
  onDelete,
  searchQuery,
  setSearchQuery,
  onNavigateUsage,
  onNavigateHome,
  onNavigateProfile,
  onNavigateBilling,
  user,
  onLogout
}) => {
  const title = mode === 'chat'
    ? 'SQLMind'
    : mode === 'dashboard'
      ? 'Dashboard Hub'
      : mode === 'usage'
        ? 'Usage & Admin'
        : mode === 'billing'
          ? 'Billing'
          : mode === 'profile'
            ? 'Profile'
            : 'Data Sources';
  const newButtonLabel = mode === 'chat'
    ? 'New Search'
    : mode === 'dashboard'
      ? 'New Dashboard'
      : mode === 'usage' || mode === 'profile' || mode === 'billing'
        ? 'Back to Chat'
        : 'New Connection';
  const historyLabel = mode === 'chat'
    ? 'Recent Chats'
    : mode === 'dashboard'
      ? 'Saved Dashboards'
      : mode === 'usage'
        ? 'Overview'
        : mode === 'billing'
          ? 'Subscription'
          : mode === 'profile'
            ? 'Profile'
            : 'Saved Connections';

  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-8">
          <div className={`w-10 h-10 ${
            mode === 'chat'
              ? 'bg-blue-600 shadow-blue-500/20'
              : mode === 'dashboard'
                ? 'bg-blue-600 shadow-blue-500/20'
                : 'bg-slate-900 shadow-slate-900/20'
          } text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg`}>
            {mode === 'chat' ? 'S' : mode === 'dashboard' ? 'D' : 'DB'}
          </div>
          <h1 className="font-bold text-xl tracking-tight text-slate-900">{title}</h1>
        </div>

        <button
          onClick={() => {
            if (mode === 'usage' || mode === 'profile') {
              onNavigateHome();
            } else {
              onNew();
            }
          }}
          className={`w-full flex items-center justify-center gap-2 py-3 ${
            mode === 'chat'
              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            : mode === 'dashboard'
              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            : 'bg-slate-900 hover:bg-black shadow-slate-900/20'
          } text-white rounded-xl transition-all font-semibold shadow-md group mb-6`}
        >
          <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          {newButtonLabel}
        </button>

        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${mode === 'chat' ? 'queries' : mode === 'dashboard' ? 'dashboards' : mode === 'usage' ? 'usage' : mode === 'billing' ? 'billing' : 'connections'}...`}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{historyLabel}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {items.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-slate-400 italic">No {mode} history</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                currentId === item.id 
                  ? `${
                      mode === 'chat'
                        ? 'bg-blue-50 border-blue-100 text-blue-700'
                        : mode === 'dashboard'
                          ? 'bg-blue-50 border-blue-100 text-blue-700'
                          : 'bg-slate-100 border-slate-200 text-slate-900'
                    } shadow-sm` 
                  : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode === 'chat' ? (
                <MessageSquareIcon className={`w-4 h-4 shrink-0 ${currentId === item.id ? 'text-blue-500' : 'text-slate-400'}`} />
              ) : mode === 'dashboard' ? (
                <LayoutDashboardIcon className={`w-4 h-4 shrink-0 ${currentId === item.id ? 'text-blue-500' : 'text-slate-400'}`} />
              ) : (
                <DatabaseIcon className={`w-4 h-4 shrink-0 ${currentId === item.id ? 'text-slate-900' : 'text-slate-400'}`} />
              )}
              <div className="flex-1 min-w-0">
                {mode === 'connections' ? (
                  <>
                    <p className="text-sm font-medium truncate leading-tight">
                      {(item as DbConnection).name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-slate-400 font-medium truncate">
                        {(item as DbConnection).host}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate leading-tight">
                      {(item as Conversation | DashboardReport).title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <CalendarIcon className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date((item as Conversation | DashboardReport).updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
              >
                <Trash2Icon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="relative">
          <div
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
          >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-sm">
            {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || user?.email || 'User'}</p>
            <p className="text-[10px] text-slate-400 truncate font-medium">{user?.role || 'Member'}</p>
          </div>
          <MoreVerticalIcon className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onNavigateProfile();
                }}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Profile Settings
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onNavigateUsage();
                }}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Usage & Admin
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onNavigateBilling();
                }}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Billing
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
