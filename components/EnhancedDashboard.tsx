import React, { useState, useCallback, useRef, useEffect } from 'react';
import 'react-grid-layout/css/styles.css';
import { DashboardItem, DashboardReport, ThemeConfig, DbConnection, ExtendedChartType } from '../types';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

// Chart types supported by SqlChart
type SqlChartType = 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'composed';

// Check if a chart type is supported by SqlChart
const isSqlChartType = (type: ExtendedChartType): type is SqlChartType => {
  return ['bar', 'line', 'pie', 'area', 'radar', 'scatter', 'composed'].includes(type);
};
import SqlChart from './SqlChart';
import KPICard from './KPICard';
import GaugeChart from './GaugeChart';
import HeatmapChart from './HeatmapChart';
import GeoMap from './GeoMap';
import ThemeCustomizer from './ThemeCustomizer';
import ReportGenerator from './ReportGenerator';
import { 
  Trash2Icon, 
  LayoutGridIcon, 
  CheckIcon,
  FileTextIcon,
  PaletteIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  Loader2Icon,
  CodeIcon,
  ExternalLinkIcon,
  ExpandIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  LightbulbIcon,
  XIcon,
  MessageSquareIcon,
  GitCompareIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SendIcon
} from 'lucide-react';
import { detectAnomalies, analyzeTrend, compareDataSeries, generateQueryOptimizationSuggestions } from '../services/analyticsService';
import 'react-grid-layout/css/styles.css';

interface EnhancedDashboardProps {
  dashboard: DashboardReport | null;
  items: DashboardItem[];
  title?: string;
  onRemove: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<DashboardItem>) => void;
  onUpdateLayout: (items: DashboardItem[]) => void;
  onRegenerateWidget: (widgetId: string, sql: string, refinementPrompt?: string) => Promise<void>;
  onUpdateItemScheme?: (id: string, scheme: string) => void;
  dbConnection: DbConnection | null;
  isEmbedMode?: boolean;
}

const DEFAULT_THEME: ThemeConfig = {
  mode: 'light',
  primaryColor: '#3b82f6',
  accentColor: '#6366f1',
  chartPalette: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']
};

// Card height constant for easy configuration
const CARD_HEIGHT = 450;

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({ 
  dashboard,
  items, 
  title = "Analytics Dashboard", 
  onRemove, 
  onUpdateItem,
  onUpdateLayout,
  onRegenerateWidget,
  onUpdateItemScheme,
  dbConnection,
  isEmbedMode = false
}) => {
  const [showShareToast, setShowShareToast] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeConfig>(dashboard?.theme || DEFAULT_THEME);
  const [regeneratingWidgets, setRegeneratingWidgets] = useState<Set<string>>(new Set());
  const [showSqlModal, setShowSqlModal] = useState<{ widgetId: string; sql: string; suggestions: string[] } | null>(null);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  
  // Refinement state for failed widgets
  const [refinementInputs, setRefinementInputs] = useState<Record<string, string>>({});
  const [showRefinementFor, setShowRefinementFor] = useState<string | null>(null);
  
  // Comparative analysis state
  const [showComparisonFor, setShowComparisonFor] = useState<string | null>(null);

  // Container ref and width for responsive grid
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  // Track if initial mount is complete to avoid layout change loops
  const isInitialMount = useRef(true);

  // Track which item is being resized
  const [resizingItemId, setResizingItemId] = useState<string | null>(null);

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 32); // Account for padding
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle widget regeneration with optional refinement prompt
  const handleRegenerate = async (widgetId: string, sql: string, refinementPrompt?: string) => {
    setRegeneratingWidgets(prev => new Set(prev).add(widgetId));
    setShowRefinementFor(null);
    try {
      await onRegenerateWidget(widgetId, sql, refinementPrompt);
      // Clear refinement input after successful regeneration
      setRefinementInputs(prev => {
        const next = { ...prev };
        delete next[widgetId];
        return next;
      });
    } finally {
      setRegeneratingWidgets(prev => {
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
    }
  };

  // Get comparative analysis for a widget
  const getComparativeAnalysis = (item: DashboardItem) => {
    if (!item.chartData || item.chartData.length < 2) return null;
    
    const yAxis = item.chartConfig.yAxis;
    const xAxis = item.chartConfig.xAxis;
    const values = item.chartData.map(d => Number(d[yAxis]) || 0);
    const labels = item.chartData.map(d => String(d[xAxis]));
    
    // Split data into two halves for comparison (first half vs second half)
    const midpoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);
    const firstLabels = labels.slice(0, midpoint);
    
    if (firstHalf.length === 0 || secondHalf.length === 0) return null;
    
    // Pad arrays to same length if needed
    while (firstHalf.length < secondHalf.length) firstHalf.push(0);
    while (secondHalf.length < firstHalf.length) secondHalf.push(0);
    
    return compareDataSeries(secondHalf, firstHalf, firstLabels);
  };

  // Show SQL with optimization suggestions
  const handleShowSql = (widgetId: string, sql: string) => {
    const suggestions = generateQueryOptimizationSuggestions(sql);
    setShowSqlModal({ widgetId, sql, suggestions });
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/embed/${dashboard?.id || 'default'}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    });
  };

  // Calculate analytics for items
  const getItemAnalytics = (item: DashboardItem) => {
    if (!item.chartData || item.chartData.length === 0) return null;
    
    const yAxis = item.chartConfig.yAxis;
    const values = item.chartData.map(d => Number(d[yAxis]) || 0);
    
    const anomalies = detectAnomalies(values, item.chartData.map(d => d[item.chartConfig.xAxis]));
    const trend = analyzeTrend(values, 'period');
    
    return { anomalies, trend };
  };

  // Render widget based on type
  const renderWidget = (item: DashboardItem) => {
    const isRegenerating = regeneratingWidgets.has(item.id);
    const analytics = getItemAnalytics(item);
    
    // Handle failed widgets
    if (item.sqlError) {
      const isShowingRefinement = showRefinementFor === item.id;
      const refinementText = refinementInputs[item.id] || '';
      
      return (
        <div className="h-full flex flex-col items-center justify-center bg-red-50 rounded-2xl border-2 border-dashed border-red-200 p-6">
          <AlertCircleIcon className="w-10 h-10 text-red-400 mb-3" />
          <h4 className="font-bold text-red-700 mb-1">{item.title}</h4>
          <p className="text-sm text-red-500 text-center mb-4 max-w-xs">{item.sqlError}</p>
          
          {item.sql && (
            <div className="flex flex-col items-center gap-3 w-full max-w-sm">
              {/* Quick Regenerate Button */}
              <button
                onClick={() => handleRegenerate(item.id, item.sql!)}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isRegenerating ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="w-4 h-4" />
                    Regenerate Chart
                  </>
                )}
              </button>
              
              {/* Toggle Refinement Input */}
              <button
                onClick={() => setShowRefinementFor(isShowingRefinement ? null : item.id)}
                className="flex items-center gap-2 text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
              >
                <MessageSquareIcon className="w-3.5 h-3.5" />
                {isShowingRefinement ? 'Hide refinement options' : 'Refine with custom instructions'}
              </button>
              
              {/* Refinement Input Panel */}
              {isShowingRefinement && (
                <div className="w-full bg-white rounded-xl border border-red-200 p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-slate-600">Custom Instructions</label>
                  <textarea
                    value={refinementText}
                    onChange={(e) => setRefinementInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="E.g., 'Use a different date range', 'Group by category instead', 'Show top 10 only'..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <button
                    onClick={() => handleRegenerate(item.id, item.sql!, refinementText)}
                    disabled={isRegenerating || !refinementText.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2Icon className="w-4 h-4 animate-spin" />
                        Refining...
                      </>
                    ) : (
                      <>
                        <SendIcon className="w-4 h-4" />
                        Refine & Regenerate
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Handle loading state
    if (item.isLoading) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-50 rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading data...</p>
          </div>
        </div>
      );
    }

    // Render based on chart type
    switch (item.chartConfig.type) {
      case 'kpi':
        return (
          <KPICard
            title={item.title}
            config={item.chartConfig.kpiConfig || { value: 0 }}
            colorScheme={item.chartConfig.colorScheme}
            height={item.height}
          />
        );
      
      case 'gauge':
        const gaugeValue = item.chartData[0]?.[item.chartConfig.yAxis] || 0;
        return (
          <GaugeChart
            title={item.title}
            value={Number(gaugeValue)}
            min={item.chartConfig.gaugeConfig?.min || 0}
            max={item.chartConfig.gaugeConfig?.max || 100}
            thresholds={item.chartConfig.gaugeConfig?.thresholds}
            height={item.height}
          />
        );
      
      case 'heatmap': {
        // Defensive: Only map if xAxis and yAxis exist and are present in data
        const xAxis = item.chartConfig.xAxis;
        const yAxis = item.chartConfig.heatmapConfig?.yCategories?.[0] || 'category';
        const yCategories = item.chartConfig.heatmapConfig?.yCategories;
        const xCategories = item.chartConfig.heatmapConfig?.xCategories;
        const safeData = Array.isArray(item.chartData) ? item.chartData : [];
        const mappedData = safeData
          .filter(d => d && d[xAxis] !== undefined && d[yAxis] !== undefined && d[item.chartConfig.yAxis] !== undefined)
          .map(d => ({
            x: d[xAxis],
            y: d[yAxis],
            value: d[item.chartConfig.yAxis]
          }));
        return (
          <HeatmapChart
            title={item.title}
            data={mappedData}
            xCategories={xCategories}
            yCategories={yCategories}
            height={item.height}
          />
        );
      }
      case 'geo': {
        let geoColorScheme: 'default' | 'heat' | 'cool' = 'default';
        if (item.chartConfig.colorScheme && ['default', 'heat', 'cool'].includes(item.chartConfig.colorScheme)) {
          geoColorScheme = item.chartConfig.colorScheme as 'default' | 'heat' | 'cool';
        }
        // Only allow mapType values supported by GeoMap
        let geoMapType: 'world' | 'usa' = 'world';
        if (item.chartConfig.geoConfig?.mapType === 'usa') geoMapType = 'usa';
        // fallback to 'world' for any other value
        return (
          <GeoMap
            data={item.chartData}
            title={item.title}
            valueLabel={item.chartConfig.yAxis}
            colorScheme={geoColorScheme}
            height={item.height}
            mapType={geoMapType}
          />
        );
      }
      default:
        return (
          <div className="relative">
            {/* Analytics overlay */}
            {analytics && analytics.trend && (
              <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                  analytics.trend.direction === 'up' 
                    ? 'bg-green-100 text-green-700'
                    : analytics.trend.direction === 'down'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {analytics.trend.direction === 'up' ? (
                    <TrendingUpIcon className="w-3 h-3" />
                  ) : analytics.trend.direction === 'down' ? (
                    <TrendingDownIcon className="w-3 h-3" />
                  ) : (
                    <MinusIcon className="w-3 h-3" />
                  )}
                  {Math.abs(analytics.trend.percentageChange).toFixed(1)}%
                </div>
                
                {analytics.anomalies.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                    <AlertCircleIcon className="w-3 h-3" />
                    {analytics.anomalies.length} anomal{analytics.anomalies.length === 1 ? 'y' : 'ies'}
                  </div>
                )}
              </div>
            )}
            
            <SqlChart
              id={item.id}
              type={item.chartConfig.type as SqlChartType}
              data={item.chartData}
              xAxis={item.chartConfig.xAxis}
              yAxis={item.chartConfig.yAxis}
              yAxisSecondary={item.chartConfig.yAxisSecondary}
              title={item.title}
              height={320}
              colorScheme={item.chartConfig.colorScheme}
              onUpdateScheme={(scheme) => onUpdateItemScheme?.(item.id, scheme)}
            />
          </div>
        );
    }
  };

  // Create dashboard report object for report generator
  const currentDashboard: DashboardReport = dashboard || {
    id: 'default',
    title: title,
    items: items,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Embed mode - simplified view
  if (isEmbedMode) {
    return (
      <div className="p-4 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {dashboard?.embedSettings?.showTitle !== false && (
            <h1 className="text-2xl font-bold text-slate-900 mb-6">{title}</h1>
          )}
          <div className="grid grid-cols-12 gap-4">
            {items.map(item => (
              <div 
                key={item.id} 
                className={`col-span-${item.colSpan}`}
                style={{ height: item.height }}
              >
                {renderWidget(item)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="dashboard-export-container" className="p-8 max-w-full mx-auto dashboard-container relative">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title Section */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <LayoutGridIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
              <p className="text-sm text-slate-500 font-medium">Real-time analytics dashboard</p>
            </div>
          </div>
          
          {/* Actions Section */}
          <div className="flex items-center gap-3 no-print">
            {/* Widget Count */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-600">{items.length} Widgets</span>
            </div>

            {/* Theme Button */}
            <button 
              onClick={() => setIsThemeOpen(true)}
              title="Customize Theme"
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <PaletteIcon className="w-5 h-5" />
            </button>

            {/* Generate Report */}
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
            >
              <FileTextIcon className="w-4 h-4" />
              <span>Report</span>
            </button>

            {/* Share Button */}
            <button 
              onClick={handleShare}
              title="Share Dashboard"
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <ExternalLinkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {showShareToast && (
        <div className="fixed top-20 right-8 z-[60] animate-in slide-in-from-right-10 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
              <CheckIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight">Embed link copied!</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Ready to share</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Row */}
      {items.filter(item => item.chartConfig.type === 'kpi').length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {items.filter(item => item.chartConfig.type === 'kpi').slice(0, 4).map(item => (
            <div key={item.id} className="h-full">
              <KPICard
                title={item.title}
                config={item.chartConfig.kpiConfig || { value: 0 }}
                colorScheme={item.chartConfig.colorScheme}
                height={120}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-dashed border-slate-300 shadow-inner">
          <div className="bg-slate-50 p-6 rounded-3xl mb-6 shadow-sm">
            <LayoutGridIcon className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Build your dashboard</h2>
          <p className="text-slate-500 mt-3 max-w-sm text-center leading-relaxed font-medium">
            Analyze datasets in the chat, then pin charts to this dashboard or use Auto-Generate.
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full">
          <ReactGridLayout
            className="layout"
            layout={items.map((item, idx) => ({
              i: item.id,
              x: (idx % 3) * 4,
              y: Math.floor(idx / 3) * 2,
              w: 4,
              h: 2,
              minW: 2,
              minH: 2,
              maxW: 12,
              maxH: 8
            }))}
            rowHeight={CARD_HEIGHT / 2}
            width={containerWidth}
            isResizable={true}
            isDraggable={false}
            margin={[16, 16]}
            onLayoutChange={(layout) => {
              // Optionally update layout in parent or state
            }}
          >
            {items.map((item) => (
              <div key={item.id} className="group">
                <div
                  className={`h-full bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all relative`}
                  style={{ minHeight: CARD_HEIGHT / 2 }}
                >
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 z-40 flex gap-1 opacity-0 group-hover:opacity-100 transition-all no-print">
                    {/* Comparative Analysis Button - only show for chart types with data */}
                    {item.chartData && item.chartData.length >= 4 && !item.sqlError && (
                      <button
                        onClick={() => setShowComparisonFor(showComparisonFor === item.id ? null : item.id)}
                        title="Comparative Analysis"
                        className={`p-2 ${showComparisonFor === item.id ? 'bg-indigo-100 text-indigo-700' : 'bg-white/90 hover:bg-white text-slate-500 hover:text-slate-700'} rounded-lg shadow-sm border border-slate-200 transition-all`}
                      >
                        <GitCompareIcon className="w-4 h-4" />
                      </button>
                    )}
                    {item.sql && (
                      <button
                        onClick={() => handleShowSql(item.id, item.sql!)}
                        title="View SQL"
                        className="p-2 bg-white/90 hover:bg-white text-slate-500 hover:text-slate-700 rounded-lg shadow-sm border border-slate-200 transition-all"
                      >
                        <CodeIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedWidget(expandedWidget === item.id ? null : item.id)}
                      title="Expand"
                      className="p-2 bg-white/90 hover:bg-white text-slate-500 hover:text-slate-700 rounded-lg shadow-sm border border-slate-200 transition-all"
                    >
                      <ExpandIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      title="Remove"
                      className="p-2 bg-white/90 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg shadow-sm border border-slate-200 transition-all"
                    >
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Comparative Analysis Panel - Inline */}
                  {showComparisonFor === item.id && item.chartData && (
                    <div className="absolute top-14 right-3 z-30 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in slide-in-from-top-2 duration-200">
                      {(() => {
                        const comparison = getComparativeAnalysis(item);
                        if (!comparison) {
                          return (
                            <p className="text-sm text-slate-500 text-center py-2">
                              Not enough data for comparison
                            </p>
                          );
                        }
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GitCompareIcon className="w-4 h-4 text-indigo-600" />
                                <h4 className="font-bold text-sm text-slate-800">Period Comparison</h4>
                              </div>
                              <button 
                                onClick={() => setShowComparisonFor(null)}
                                className="p-1 hover:bg-slate-100 rounded-lg"
                              >
                                <XIcon className="w-4 h-4 text-slate-400" />
                              </button>
                            </div>
                            
                            {/* Overall Change */}
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${
                              comparison.totalChange > 0 
                                ? 'bg-green-50 border border-green-100' 
                                : comparison.totalChange < 0 
                                  ? 'bg-red-50 border border-red-100'
                                  : 'bg-slate-50 border border-slate-100'
                            }`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                comparison.totalChange > 0 
                                  ? 'bg-green-100 text-green-700' 
                                  : comparison.totalChange < 0 
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-slate-200 text-slate-600'
                              }`}>
                                {comparison.totalChange > 0 ? (
                                  <ArrowUpIcon className="w-4 h-4" />
                                ) : comparison.totalChange < 0 ? (
                                  <ArrowDownIcon className="w-4 h-4" />
                                ) : (
                                  <MinusIcon className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Total Change</p>
                                <p className={`font-bold ${
                                  comparison.totalChange > 0 
                                    ? 'text-green-700' 
                                    : comparison.totalChange < 0 
                                      ? 'text-red-700'
                                      : 'text-slate-600'
                                }`}>
                                  {comparison.totalChange > 0 ? '+' : ''}{comparison.totalChange.toFixed(1)}%
                                </p>
                              </div>
                            </div>

                            {/* Average Change */}
                            <div className="flex items-center justify-between py-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500">Average Change</span>
                              <span className={`text-sm font-bold ${
                                comparison.averageChange > 0 
                                  ? 'text-green-600' 
                                  : comparison.averageChange < 0 
                                    ? 'text-red-600'
                                    : 'text-slate-500'
                              }`}>
                                {comparison.averageChange > 0 ? '+' : ''}{comparison.averageChange.toFixed(1)}%
                              </span>
                            </div>

                            {/* Improvements vs Declines */}
                            <div className="flex items-center justify-between py-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500">Improvements</span>
                              <span className="text-sm font-bold text-green-600">{comparison.improvements}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500">Declines</span>
                              <span className="text-sm font-bold text-red-600">{comparison.declines}</span>
                            </div>

                            {/* Best and Worst Performers */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Top Performers</p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 flex items-center gap-1">
                                  <ArrowUpIcon className="w-3 h-3 text-green-500" />
                                  <span className="truncate max-w-[120px]">{comparison.bestPerformer.label}</span>
                                </span>
                                <span className="font-semibold text-green-600">
                                  +{comparison.bestPerformer.change.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 flex items-center gap-1">
                                  <ArrowDownIcon className="w-3 h-3 text-red-500" />
                                  <span className="truncate max-w-[120px]">{comparison.worstPerformer.label}</span>
                                </span>
                                <span className="font-semibold text-red-600">
                                  {comparison.worstPerformer.change.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Widget Content */}
                  <div className="p-2 pb-10 overflow-hidden" style={{ minHeight: CARD_HEIGHT / 2 - 36 }}>
                    {renderWidget({ ...item, height: CARD_HEIGHT - 36 })}
                  </div>

                  {/* Footer */}
                  <div className="absolute bottom-0 left-0 right-0 h-9 px-3 py-1.5 bg-slate-50/90 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
                    </div>
                    {item.lastRefreshed && (
                      <span className="text-[10px] text-slate-300 font-medium">
                        {new Date(item.lastRefreshed).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </ReactGridLayout>
        </div>
      )}

      {/* SQL Modal with Optimization Suggestions */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <CodeIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg">SQL Query & Optimization</h3>
              </div>
              <button onClick={() => setShowSqlModal(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                <XIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* SQL Code */}
              <div className="bg-slate-950 rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated SQL</span>
                </div>
                <pre className="p-4 text-sm text-indigo-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  {showSqlModal.sql}
                </pre>
              </div>

              {/* Optimization Suggestions */}
              {showSqlModal.suggestions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <LightbulbIcon className="w-5 h-5 text-amber-600" />
                    <h4 className="font-bold text-amber-800">Optimization Suggestions</h4>
                  </div>
                  <ul className="space-y-2">
                    {showSqlModal.suggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <span className="text-amber-500 mt-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showSqlModal.sql);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Copy SQL
              </button>
              <button
                onClick={() => setShowSqlModal(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Widget Modal */}
      {expandedWidget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-lg">{items.find(i => i.id === expandedWidget)?.title}</h3>
              <button onClick={() => setExpandedWidget(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                <XIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 h-[calc(100%-70px)]">
              {items.find(i => i.id === expandedWidget) && (() => {
                const expandedItem = items.find(i => i.id === expandedWidget)!;
                return (
                  <SqlChart
                    type={expandedItem.chartConfig.type as SqlChartType}
                    xAxis={expandedItem.chartConfig.xAxis}
                    yAxis={expandedItem.chartConfig.yAxis}
                    yAxisSecondary={expandedItem.chartConfig.yAxisSecondary}
                    title={expandedItem.chartConfig.title}
                    colorScheme={expandedItem.chartConfig.colorScheme}
                    data={expandedItem.chartData}
                    height={500}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Theme Customizer */}
      <ThemeCustomizer
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Report Generator */}
      <ReportGenerator
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        dashboard={currentDashboard}
        items={items}
      />
    </div>
  );
};

export default EnhancedDashboard;
