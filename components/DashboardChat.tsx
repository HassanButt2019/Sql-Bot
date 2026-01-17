import React, { useMemo, useState } from 'react';
import { DashboardItem, DbConnection } from '../types';
import { queryDashboardChat, DashboardChatWidget } from '../services/dashboardChatService';
import { MessageSquareIcon, SendIcon, XIcon, AlertCircleIcon, CheckCircleIcon } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  widgets?: DashboardChatWidget[];
}

interface DashboardChatProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  dbConnection: DbConnection | null;
  schemaContext: string;
  dashboardItems: DashboardItem[];
  onAddItems: (items: DashboardItem[]) => void;
}

const DashboardChat: React.FC<DashboardChatProps> = ({
  isOpen,
  onClose,
  apiKey,
  dbConnection,
  schemaContext,
  dashboardItems,
  onAddItems
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => {
    return !!input.trim() && !!apiKey && !!dbConnection && !!schemaContext.trim();
  }, [input, apiKey, dbConnection, schemaContext]);

  if (!isOpen) return null;

  const convertWidgetsToItems = (widgets: DashboardChatWidget[]): DashboardItem[] => {
    return widgets
      .filter(widget => widget.chartData && widget.chartData.length > 0 && !widget.sqlError)
      .map(widget => ({
        id: `dashchat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        title: widget.title,
        chartConfig: {
          type: widget.chartConfig.type as any,
          xAxis: widget.chartConfig.xAxis,
          yAxis: widget.chartConfig.yAxis,
          title: widget.chartConfig.title,
          colorScheme: widget.chartConfig.colorScheme as any
        },
        chartData: widget.chartData,
        addedAt: Date.now(),
        colSpan: 6,
        height: 500,
        sql: widget.sql,
        sqlError: widget.sqlError
      }));
  };

  const handleSend = async () => {
    if (!canSend || !dbConnection) return;

    const prompt = input.trim();
    setInput('');
    setError(null);
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: prompt
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await queryDashboardChat(
        prompt,
        schemaContext,
        apiKey,
        dbConnection,
        dashboardItems
      );

      const itemsToAdd = convertWidgetsToItems(result.widgets);
      if (itemsToAdd.length > 0) {
        onAddItems(itemsToAdd);
      }

      const summary = itemsToAdd.length > 0
        ? `Added ${itemsToAdd.length} new chart${itemsToAdd.length > 1 ? 's' : ''} to your dashboard.`
        : 'No charts were added. Try refining the request.';

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: result.summary ? `${result.summary} ${summary}` : summary,
        widgets: result.widgets
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get a response');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-right-6 duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <MessageSquareIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Dashboard Chat</h3>
              <p className="text-xs text-slate-500 font-medium">Ask for new charts to add to this dashboard</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5">
              Try: "Add a cash flow trend by month" or "Show AP aging by vendor".
            </div>
          )}

          {messages.map(message => (
            <div key={message.id} className={message.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={`inline-block px-4 py-3 rounded-2xl text-sm font-semibold ${
                message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}>
                {message.content}
              </div>
              {message.widgets && message.widgets.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.widgets.map((widget, idx) => (
                    <div key={`${message.id}-${idx}`} className="flex items-center gap-2 text-xs text-slate-600">
                      {widget.sqlError ? (
                        <AlertCircleIcon className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                      )}
                      <span>{widget.title}</span>
                      {widget.sqlError && <span className="text-amber-600">({widget.sqlError})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 p-4">
          {error && (
            <div className="mb-3 text-xs text-red-600 font-semibold">{error}</div>
          )}
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={dbConnection ? 'Ask for a new chart...' : 'Connect a database first...'}
              disabled={!dbConnection || isSending}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-semibold"
            />
            <button
              onClick={handleSend}
              disabled={!canSend || isSending}
              className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 disabled:opacity-40"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardChat;
