import { useCallback, useMemo, useRef, useState } from 'react';
import { Conversation, DbConnection, Message } from '../types';
import { queryModel } from '../services/llmRouter';

interface UseChatArgs {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  activeConnection: DbConnection | undefined;
  excelWorkbook: unknown;
  isExcelConnection: boolean;
  localExecutor?: (sql: string) => Promise<any[]>;
  openAiApiKey: string;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveTab: React.Dispatch<React.SetStateAction<'chat' | 'dashboard' | 'connections' | 'integrations'>>;
  getFullSchemaContext: () => string;
}

export function useChat(args: UseChatArgs) {
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentConversation = useMemo(
    () => args.conversations.find(c => c.id === args.currentChatId),
    [args.conversations, args.currentChatId]
  );

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isTyping || (!args.activeConnection && !args.excelWorkbook)) return;

    if (!args.openAiApiKey) {
      args.setIsSettingsOpen(true);
      return;
    }

    let targetId = args.currentChatId;
    if (!targetId) {
      const id = Date.now().toString();
      const newConv: Conversation = { id, title: userInput.slice(0, 30) + '...', messages: [], updatedAt: Date.now(), model: 'gpt-4o' };
      args.setConversations([newConv, ...args.conversations]);
      targetId = id;
      args.setCurrentChatId(id);
    }

    const schemaContext = args.getFullSchemaContext();
    if (!schemaContext) {
      args.setActiveTab('connections');
      return;
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userInput, timestamp: Date.now() };
    const botMessagePlaceholder: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Analyzing schema...', timestamp: Date.now() };

    args.setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: [...c.messages, userMessage, botMessagePlaceholder], updatedAt: Date.now() } : c));
    setUserInput('');
    setIsTyping(true);

    try {
      const result = await queryModel(
        userMessage.content,
        schemaContext,
        args.openAiApiKey,
        args.isExcelConnection ? null : (args.activeConnection ?? null),
        (chunkText) => {
          args.setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, content: chunkText } : m) } : c));
        },
        args.localExecutor
      );

      args.setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, ...result, content: result.content || 'Report generated.' } : m) } : c));
    } catch (error: any) {
      console.error(error);
      args.setConversations(prev => prev.map(c => c.id === targetId ? { ...c, messages: c.messages.map(m => m.id === botMessagePlaceholder.id ? { ...m, content: `Error: ${error.message}` } : m) } : c));
    } finally {
      setIsTyping(false);
    }
  }, [args, isTyping, userInput]);

  const updateMessageColorScheme = useCallback((messageId: string, scheme: string) => {
    args.setConversations(prev => prev.map(c => c.id === args.currentChatId ? { ...c, messages: c.messages.map(m => m.id === messageId && m.chartConfig ? { ...m, chartConfig: { ...m.chartConfig, colorScheme: scheme as any } } : m) } : c));
  }, [args]);

  return {
    userInput,
    setUserInput,
    isTyping,
    currentConversation,
    chatEndRef,
    scrollToBottom,
    handleSendMessage,
    updateMessageColorScheme
  };
}
