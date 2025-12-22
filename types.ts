export type LLMModel = 'gpt-4o';
export type DbDialect = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'auto';
export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
  chartPalette: string[];
}

// Date range filter types
export interface DateRangeFilter {
  startDate: string | null;
  endDate: string | null;
  preset: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom' | null;
}

// Anomaly detection types
export interface AnomalyPoint {
  index: number;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

// Trend analysis types
export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  percentageChange: number;
  period: string;
  confidence: number;
}

// KPI Card types
export interface KPICardConfig {
  value: number | string;
  previousValue?: number;
  changePercentage?: number;
  changeDirection?: 'up' | 'down' | 'stable';
  sparklineData?: number[];
  target?: number;
  unit?: string;
  format?: 'number' | 'currency' | 'percentage';
}

// Chart types extended
export type ExtendedChartType = 
  | 'bar' 
  | 'line' 
  | 'pie' 
  | 'area' 
  | 'radar' 
  | 'scatter' 
  | 'composed'
  | 'kpi'           // KPI Card
  | 'gauge'         // Gauge Chart
  | 'heatmap'       // Heatmap
  | 'geo'           // Geographic Map
  | 'combo'         // Combo Chart (bar + line)
  | 'treemap'       // Treemap
  | 'funnel';       // Funnel Chart

export interface TableInfo {
  name: string;
  schema: string;
  selected: boolean;
}

export interface DbConnectionConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  dialect: DbDialect;
  connectionString?: string;
  useConnectionString?: boolean;
}

export interface DbConnection {
  id: string;
  name: string;
  host: string;
  port: string;
  username: string;
  database: string;
  dialect: DbDialect;
  connectionString?: string;
  useConnectionString?: boolean;
  tables: TableInfo[];
  isActive: boolean;
  status: 'connected' | 'error' | 'disconnected';
  errorMessage?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sql?: string;
  sqlExplanation?: string; // AI explanation of the SQL query
  queryOptimizationSuggestions?: string[]; // Query optimization tips
  explanation?: string;
  chartData?: any[];
  chartConfig?: {
    type: ExtendedChartType;
    xAxis: string;
    yAxis: string;
    yAxisSecondary?: string;
    title: string;
    colorScheme?: 'default' | 'performance' | 'categorical' | 'warm' | 'cool' | 'trust' | 'growth' | 'alert';
    customColors?: string[];
    showLabels?: boolean;
    // KPI specific
    kpiConfig?: KPICardConfig;
    // Gauge specific
    gaugeConfig?: {
      min: number;
      max: number;
      thresholds?: { value: number; color: string }[];
    };
    // Heatmap specific
    heatmapConfig?: {
      xCategories: string[];
      yCategories: string[];
    };
    // Geo specific
    geoConfig?: {
      mapType: 'world' | 'usa' | 'europe';
      valueField: string;
      locationField: string;
    };
    // Anomaly detection
    showAnomalies?: boolean;
    anomalies?: AnomalyPoint[];
    // Trend analysis
    trendAnalysis?: TrendAnalysis;
    // Comparative analysis
    comparisonData?: any[];
    comparisonLabel?: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  model: LLMModel;
}

export interface DashboardItem {
  id: string;
  title: string;
  chartConfig: NonNullable<Message['chartConfig']>;
  chartData: any[];
  addedAt: number;
  colSpan: 4 | 6 | 12;
  height: number;
  // New properties for enhanced features
  position?: { x: number; y: number }; // For drag & drop
  minHeight?: number;
  maxHeight?: number;
  sql?: string; // Store SQL for regeneration
  sqlError?: string; // Store error for failed widgets
  isLoading?: boolean;
  lastRefreshed?: number;
  // Date filter override (null means use global filter)
  dateFilterOverride?: DateRangeFilter | null;
}

export interface DashboardReport {
  id: string;
  title: string;
  items: DashboardItem[];
  createdAt: number;
  updatedAt: number;
  // New properties
  globalDateFilter?: DateRangeFilter;
  theme?: ThemeConfig;
  isEmbedMode?: boolean;
  embedSettings?: {
    showTitle: boolean;
    showFilters: boolean;
    allowInteraction: boolean;
    refreshInterval?: number; // in seconds
  };
  layout?: 'grid' | 'freeform';
}

// Widget regeneration context
export interface WidgetRegenerationContext {
  widgetId: string;
  originalSql: string;
  error: string;
  prompt?: string;
}
