import React, { useState } from 'react';
import { DbConnection, DashboardItem } from '../types';
import { 
  generateAutoDashboard, 
  convertToDashboardItems, 
  DASHBOARD_PRESETS,
  AutoDashboardPreset,
  AutoDashboardResult,
  AutoDashboardWidget,
  regenerateSingleWidget
} from '../services/autoDashboardService';
import {
  SparklesIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  XIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  WandIcon,
  BarChart3Icon,
  PieChartIcon,
  TrendingUpIcon,
  UsersIcon,
  PackageIcon,
  DollarSignIcon,
  SettingsIcon,
  CalendarIcon,
  ZapIcon,
  PlusIcon,
  RefreshCwIcon,
  MessageSquareIcon,
  EditIcon
} from 'lucide-react';

interface AutoDashboardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onDashboardGenerated: (items: DashboardItem[], title: string) => void;
  dbConnection: DbConnection | null;
  schemaContext: string;
  apiKey: string;
  localExecutor?: (sql: string) => Promise<any[]>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  sales: <DollarSignIcon className="w-5 h-5" />,
  finance: <TrendingUpIcon className="w-5 h-5" />,
  operations: <SettingsIcon className="w-5 h-5" />,
  customers: <UsersIcon className="w-5 h-5" />,
  products: <PackageIcon className="w-5 h-5" />,
  general: <BarChart3Icon className="w-5 h-5" />
};

const CATEGORY_COLORS: Record<string, string> = {
  sales: 'bg-green-500',
  finance: 'bg-blue-500',
  operations: 'bg-orange-500',
  customers: 'bg-purple-500',
  products: 'bg-pink-500',
  general: 'bg-slate-500'
};

const AutoDashboardGenerator: React.FC<AutoDashboardGeneratorProps> = ({
  isOpen,
  onClose,
  onDashboardGenerated,
  dbConnection,
  schemaContext,
  apiKey,
  localExecutor
}) => {
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [customPrompt, setCustomPrompt] = useState('');
  const [widgetCount, setWidgetCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<AutoDashboardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<AutoDashboardPreset | null>(null);
  
  // Regeneration state
  const [regeneratingWidgetId, setRegeneratingWidgetId] = useState<string | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState<Record<string, string>>({});
  const [showRefinementInput, setShowRefinementInput] = useState<string | null>(null);

  const handleGenerate = async (prompt: string) => {
    if (!dbConnection && !localExecutor) {
      setError('Please connect to a database or upload an Excel file first.');
      return;
    }

    if (!apiKey) {
      setError('Please add your OpenAI API key in Settings.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress('Starting...');
    setResult(null);

    try {
      const dashboardResult = await generateAutoDashboard(
        prompt,
        schemaContext,
        apiKey,
        dbConnection,
        widgetCount,
        setProgress,
        localExecutor
      );
      
      setResult(dashboardResult);
      setProgress('');
      
    } catch (err: any) {
      setError(err.message || 'Failed to generate dashboard');
      setProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle regenerating a single failed widget
  const handleRegenerateWidget = async (widget: AutoDashboardWidget, customRefinement?: string) => {
    if ((!dbConnection && !localExecutor) || !apiKey) return;

    setRegeneratingWidgetId(widget.id);
    setShowRefinementInput(null);

    try {
      const regeneratedWidget = await regenerateSingleWidget(
        widget,
        schemaContext,
        apiKey,
        dbConnection,
        customRefinement || refinementPrompt[widget.id],
        localExecutor
      );

      // Update the result with the regenerated widget
      setResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          widgets: prev.widgets.map(w => 
            w.id === widget.id ? regeneratedWidget : w
          )
        };
      });

      // Clear refinement prompt
      setRefinementPrompt(prev => {
        const next = { ...prev };
        delete next[widget.id];
        return next;
      });

    } catch (err: any) {
      // Update widget with new error
      setResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          widgets: prev.widgets.map(w => 
            w.id === widget.id ? { ...w, sqlError: err.message } : w
          )
        };
      });
    } finally {
      setRegeneratingWidgetId(null);
    }
  };

  const handleAddToDashboard = () => {
    if (result) {
      const items = convertToDashboardItems(result.widgets);
      onDashboardGenerated(items, result.dashboardTitle);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setProgress('');
    setSelectedPreset(null);
    setCustomPrompt('');
    setRefinementPrompt({});
    setShowRefinementInput(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Auto-Generate Dashboard</h2>
                <p className="text-violet-200 text-sm">AI creates multiple widgets from a single prompt</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {!result ? (
            <>
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-8 p-1 bg-slate-100 rounded-2xl w-fit">
                <button
                  onClick={() => setMode('presets')}
                  className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                    mode === 'presets' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LayoutDashboardIcon className="w-4 h-4 inline mr-2" />
                  Dashboard Presets
                </button>
                <button
                  onClick={() => setMode('custom')}
                  className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                    mode === 'custom' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <WandIcon className="w-4 h-4 inline mr-2" />
                  Custom Prompt
                </button>
              </div>

              {/* Connection Status */}
              {!dbConnection && !localExecutor && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                  <AlertCircleIcon className="w-5 h-5 text-amber-500" />
                  <span className="text-amber-700 text-sm">Connect to a database or upload Excel to generate dashboards</span>
                </div>
              )}

              {/* Presets Mode */}
              {mode === 'presets' && (
                <div className="space-y-4">
                  <p className="text-slate-600 mb-4">
                    Choose a pre-built dashboard template. AI will analyze your schema and create relevant widgets.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {DASHBOARD_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset)}
                        disabled={isGenerating}
                        className={`p-5 rounded-2xl border-2 text-left transition-all ${
                          selectedPreset?.id === preset.id
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 ${CATEGORY_COLORS[preset.category]} rounded-xl flex items-center justify-center text-white`}>
                            {CATEGORY_ICONS[preset.category]}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{preset.icon}</span>
                              <h3 className="font-bold text-slate-900">{preset.name}</h3>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{preset.description}</p>
                          </div>
                          {selectedPreset?.id === preset.id && (
                            <CheckCircleIcon className="w-6 h-6 text-violet-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Mode */}
              {mode === 'custom' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Describe the dashboard you want
                    </label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g., Create a sales performance dashboard showing monthly revenue trends, top products by sales, regional distribution, and order status breakdown"
                      className="w-full h-32 px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none"
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Number of Widgets
                      </label>
                      <div className="flex items-center gap-2">
                        {[2, 4, 6, 8].map(count => (
                          <button
                            key={count}
                            onClick={() => setWidgetCount(count)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                              widgetCount === count
                                ? 'bg-violet-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Example prompts */}
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-3">EXAMPLE PROMPTS:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Monthly sales and revenue trends',
                        'Customer segmentation analysis',
                        'Product inventory and stock levels',
                        'Order fulfillment metrics',
                        'Year-over-year comparison',
                        'Showcase all widget types (KPI, gauge, heatmap, geo, bar, line, pie, area, radar, scatter, composed)'
                      ].map(example => (
                        <button
                          key={example}
                          onClick={() => setCustomPrompt(example)}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-violet-50 hover:border-violet-300 transition-colors"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
                  <AlertCircleIcon className="w-5 h-5 text-red-500" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}

              {/* Progress Display */}
              {isGenerating && (
                <div className="mt-6 p-6 bg-violet-50 border border-violet-200 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <Loader2Icon className="w-6 h-6 text-violet-600 animate-spin" />
                    <div>
                      <p className="font-semibold text-violet-900">Generating Dashboard...</p>
                      <p className="text-sm text-violet-600">{progress}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Results View */
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-2xl">
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
                <div>
                  <h3 className="font-bold text-green-900">{result.dashboardTitle}</h3>
                  <p className="text-sm text-green-700">{result.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900">Generated Widgets ({result.widgets.length})</h4>
                
                <div className="grid gap-3">
                  {result.widgets.map((widget, index) => (
                    <div 
                      key={widget.id}
                      className={`p-4 rounded-xl border ${
                        widget.sqlError 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                            widget.sqlError ? 'bg-red-400' : 'bg-violet-500'
                          }`}>
                            {widget.chartConfig.type === 'pie' ? (
                              <PieChartIcon className="w-4 h-4" />
                            ) : widget.chartConfig.type === 'line' || widget.chartConfig.type === 'area' ? (
                              <TrendingUpIcon className="w-4 h-4" />
                            ) : (
                              <BarChart3Icon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h5 className="font-semibold text-slate-900">{widget.title}</h5>
                            <p className="text-xs text-slate-500">
                              {widget.chartConfig.type.toUpperCase()} • {widget.chartData.length} rows
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {widget.sqlError ? (
                            <>
                              <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                Query Error
                              </span>
                              {/* Regenerate button for failed widgets */}
                              <button
                                onClick={() => handleRegenerateWidget(widget)}
                                disabled={regeneratingWidgetId === widget.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {regeneratingWidgetId === widget.id ? (
                                  <Loader2Icon className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCwIcon className="w-3 h-3" />
                                )}
                                Regenerate
                              </button>
                              {/* Refine with custom prompt */}
                              <button
                                onClick={() => setShowRefinementInput(
                                  showRefinementInput === widget.id ? null : widget.id
                                )}
                                className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-200 transition-colors"
                              >
                                <EditIcon className="w-3 h-3" />
                                Refine
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Error message */}
                      {widget.sqlError && (
                        <p className="mt-2 text-xs text-red-600">{widget.sqlError}</p>
                      )}

                      {/* Refinement input */}
                      {showRefinementInput === widget.id && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                          <p className="text-xs font-semibold text-amber-700 mb-2">
                            <MessageSquareIcon className="w-3 h-3 inline mr-1" />
                            Iterative Refinement: Tell AI how to fix this widget
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={refinementPrompt[widget.id] || ''}
                              onChange={(e) => setRefinementPrompt(prev => ({
                                ...prev,
                                [widget.id]: e.target.value
                              }))}
                              placeholder="e.g., Use a different table, group by month instead of day..."
                              className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleRegenerateWidget(widget, refinementPrompt[widget.id])}
                              disabled={regeneratingWidgetId === widget.id || !refinementPrompt[widget.id]}
                              className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                              {regeneratingWidgetId === widget.id ? (
                                <Loader2Icon className="w-4 h-4 animate-spin" />
                              ) : (
                                'Apply'
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {result.widgets.filter(w => !w.sqlError).length === 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-amber-700 text-sm">
                    All queries failed. This might be due to schema mismatch. Try using the "Refine" button to provide hints for fixing each widget.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-8 py-4 bg-slate-50 flex items-center justify-between">
          {!result ? (
            <>
              <button
                onClick={onClose}
                className="px-6 py-3 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const prompt = mode === 'presets' && selectedPreset 
                    ? selectedPreset.prompt 
                    : customPrompt;
                  handleGenerate(prompt);
                }}
                disabled={
                  isGenerating || 
                  (!dbConnection && !localExecutor) || 
                  (mode === 'presets' && !selectedPreset) ||
                  (mode === 'custom' && !customPrompt.trim())
                }
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
              >
                {isGenerating ? (
                  <>
                    <Loader2Icon className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ZapIcon className="w-5 h-5" />
                    Generate Dashboard
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="px-6 py-3 text-slate-600 hover:text-slate-900 font-semibold transition-colors"
              >
                ← Generate Another
              </button>
              <button
                onClick={handleAddToDashboard}
                disabled={result.widgets.filter(w => !w.sqlError).length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
              >
                <PlusIcon className="w-5 h-5" />
                Add {result.widgets.filter(w => !w.sqlError).length} Widgets to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoDashboardGenerator;
