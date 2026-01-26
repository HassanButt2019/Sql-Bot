import { useCallback, useMemo, useState } from 'react';
import { DashboardItem, DashboardReport, DbConnection, Message } from '../types';
import { regenerateSingleWidget } from '../services/autoDashboardService';

interface UseDashboardArgs {
  initialDashboards: DashboardReport[];
  setActiveTab: React.Dispatch<React.SetStateAction<'chat' | 'dashboard' | 'connections' | 'integrations'>>;
  openAiApiKey: string;
  activeConnection: DbConnection | undefined;
  isExcelConnection: boolean;
  localExecutor?: (sql: string) => Promise<any[]>;
  getFullSchemaContext: () => string;
}

export function useDashboard(args: UseDashboardArgs) {
  const [dashboards, setDashboards] = useState<DashboardReport[]>(args.initialDashboards);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [pendingExportMessage, setPendingExportMessage] = useState<Message | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | 'new' | null>(null);
  const [exportDashboardName, setExportDashboardName] = useState('');
  const [isAutoDashboardOpen, setIsAutoDashboardOpen] = useState(false);
  const [useEnhancedDashboard, setUseEnhancedDashboard] = useState(true);

  const currentDashboard = useMemo(
    () => dashboards.find(d => d.id === currentDashboardId),
    [dashboards, currentDashboardId]
  );

  const updateDashboardItemColorScheme = useCallback((itemId: string, scheme: string) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { ...d, items: d.items.map(item => item.id === itemId ? { ...item, chartConfig: { ...item.chartConfig, colorScheme: scheme as any } } : item) } : d));
  }, [currentDashboardId]);

  const removeFromDashboard = useCallback((itemId: string) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? { ...d, items: d.items.filter(item => item.id !== itemId), updatedAt: Date.now() } : d));
  }, [currentDashboardId]);

  const updateDashboardItemSize = useCallback((itemId: string, size: 4 | 6 | 12) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? {
      ...d,
      items: d.items.map(item => item.id === itemId ? { ...item, colSpan: size } : item),
      updatedAt: Date.now()
    } : d));
  }, [currentDashboardId]);

  const updateDashboardItem = useCallback((itemId: string, updates: Partial<DashboardItem>) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? {
      ...d,
      items: d.items.map(item => item.id === itemId ? { ...item, ...updates } : item),
      updatedAt: Date.now()
    } : d));
  }, [currentDashboardId]);

  const updateDashboardLayout = useCallback((updatedItems: DashboardItem[]) => {
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? {
      ...d,
      items: updatedItems,
      updatedAt: Date.now()
    } : d));
  }, [currentDashboardId]);

  const appendDashboardItems = useCallback((newItems: DashboardItem[]) => {
    if (!currentDashboardId || newItems.length === 0) return;
    setDashboards(prev => prev.map(d => d.id === currentDashboardId ? {
      ...d,
      items: [...newItems, ...d.items],
      updatedAt: Date.now()
    } : d));
  }, [currentDashboardId]);

  const handleRegenerateWidget = useCallback(async (widgetId: string, sql: string, refinementPrompt?: string): Promise<void> => {
    if (!args.activeConnection || !args.openAiApiKey) return;
    const widget = currentDashboard?.items.find(i => i.id === widgetId);
    if (!widget) return;

    updateDashboardItem(widgetId, { isLoading: true, sqlError: undefined });

    try {
      const schemaContext = args.getFullSchemaContext();
      const widgetForRegeneration = {
        id: widget.id,
        title: widget.title,
        sql: widget.sql || sql,
        explanation: '',
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
        args.openAiApiKey,
        args.isExcelConnection ? null : args.activeConnection,
        refinementPrompt,
        args.localExecutor
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
  }, [args, currentDashboard, updateDashboardItem]);

  const openExportDialog = useCallback((message: Message) => {
    setPendingExportMessage(message);
    setSelectedTargetId(currentDashboardId || (dashboards.length > 0 ? dashboards[0].id : 'new'));
    setIsExportDialogOpen(true);
  }, [currentDashboardId, dashboards]);

  const handleAutoDashboardGenerated = useCallback((items: DashboardItem[], title: string) => {
    const newDashboardId = Date.now().toString();
    const newDashboard: DashboardReport = {
      id: newDashboardId,
      title,
      items,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setDashboards(prev => [newDashboard, ...prev]);
    setCurrentDashboardId(newDashboardId);
    args.setActiveTab('dashboard');
  }, [args]);

  const handleFinalExport = useCallback(() => {
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
    args.setActiveTab('dashboard');
  }, [args, dashboards, exportDashboardName, pendingExportMessage, selectedTargetId]);

  return {
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
    setUseEnhancedDashboard,
    updateDashboardItemColorScheme,
    removeFromDashboard,
    updateDashboardItemSize,
    updateDashboardItem,
    updateDashboardLayout,
    appendDashboardItems,
    handleRegenerateWidget,
    openExportDialog,
    handleAutoDashboardGenerated,
    handleFinalExport
  };
}
