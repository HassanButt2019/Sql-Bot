import { ChartConfig, DbConnection, DashboardItem } from '../types';
import { limitChartData } from './excelDuckdbService';
import { ApiClient, defaultApiClient } from './apiClient';
import { buildDbConnectionInfo, PasswordStore } from './dbConnectionInfo';
import { getCapabilityToken } from './capabilitiesService';

export interface AutoDashboardWidget {
  id: string;
  title: string;
  sql: string;
  explanation: string;
  chartConfig: ChartConfig;
  chartData: any[];
  sqlError?: string;
  addedAt: number;
}

export interface AutoDashboardResult {
  dashboardTitle: string;
  description: string;
  widgets: AutoDashboardWidget[];
  generatedAt: number;
}

export interface AutoDashboardPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
  category: 'sales' | 'finance' | 'operations' | 'customers' | 'products' | 'general';
}

// Pre-built dashboard templates for common use cases
export const DASHBOARD_PRESETS: AutoDashboardPreset[] = [
  {
    id: 'sales-overview',
    name: 'Sales Overview',
    description: 'Revenue, trends, top products, and regional performance',
    prompt: 'Create a comprehensive sales dashboard showing total revenue, sales trends over time, top performing products, and sales by region or category',
    icon: '💰',
    category: 'sales'
  },
  {
    id: 'product-performance',
    name: 'Product Performance',
    description: 'Product rankings, inventory, and profitability',
    prompt: 'Create a product performance dashboard showing top products by revenue, product category distribution, inventory levels, and profit margins',
    icon: '📦',
    category: 'products'
  },
  {
    id: 'customer-analytics',
    name: 'Customer Analytics',
    description: 'Customer segments, acquisition, and behavior',
    prompt: 'Create a customer analytics dashboard showing customer distribution, new vs returning customers, top customers by value, and customer geographic distribution',
    icon: '👥',
    category: 'customers'
  },
  {
    id: 'financial-summary',
    name: 'Financial Summary',
    description: 'Revenue, expenses, margins, and cash flow',
    prompt: 'Create a financial summary dashboard showing total revenue and expenses, profit margins, month-over-month growth, and cost breakdown by category',
    icon: '📊',
    category: 'finance'
  },
  {
    id: 'operations-metrics',
    name: 'Operations Metrics',
    description: 'Orders, fulfillment, and efficiency',
    prompt: 'Create an operations dashboard showing order volume trends, order status distribution, average processing times, and fulfillment metrics',
    icon: '⚙️',
    category: 'operations'
  },
  {
    id: 'ap-ar-aging',
    name: 'AP/AR Aging',
    description: 'Payables and receivables aging buckets',
    prompt: 'Create a finance ops dashboard with AP aging by vendor, AR aging by customer, overdue balances, and aging trends over time',
    icon: '🧾',
    category: 'finance'
  },
  {
    id: 'cash-conversion',
    name: 'Cash Conversion Cycle',
    description: 'CCC drivers and cash velocity',
    prompt: 'Create a dashboard for cash conversion cycle with days sales outstanding, days payable outstanding, days inventory on hand, and overall CCC trend',
    icon: '💸',
    category: 'finance'
  },
  {
    id: 'vendor-concentration',
    name: 'Vendor Concentration',
    description: 'Top vendors and spend concentration risk',
    prompt: 'Create a vendor concentration dashboard showing top vendors by spend, percentage share, and spend trend over time',
    icon: '🏷️',
    category: 'operations'
  },
  {
    id: 'budget-vs-actual',
    name: 'Budget vs Actual',
    description: 'Variance by product, region, and period',
    prompt: 'Create a budget vs actual dashboard showing total budget vs actual, variance by product or cost center, and variance trend over time',
    icon: '📊',
    category: 'finance'
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level KPIs and business health',
    prompt: 'Create an executive summary dashboard with key business metrics: total revenue, order count, average order value, top products, and recent trends',
    icon: '🎯',
    category: 'general'
  },
  {
    id: 'inventory-status',
    name: 'Inventory Status',
    description: 'Stock levels, turnover, and alerts',
    prompt: 'Create an inventory dashboard showing current stock levels by product, low stock alerts, inventory turnover rates, and stock value by category',
    icon: '📋',
    category: 'operations'
  },
  {
    id: 'time-analysis',
    name: 'Time-Based Analysis',
    description: 'Daily, weekly, monthly patterns',
    prompt: 'Create a time-based analytics dashboard showing daily patterns, weekly trends, monthly comparisons, and year-over-year growth',
    icon: '📅',
    category: 'general'
  },
  {
    id: 'all-widgets-demo',
    name: 'All Widgets Demo',
    description: 'Showcase of all available widget types: KPIs, gauges, heatmaps, geo maps, and charts',
    prompt: 'Create a dashboard that demonstrates all available widget types: a KPI card for revenue, a gauge for performance, a heatmap for activity, a geo map for regional data, and a variety of standard charts (bar, line, pie, area, radar, scatter, composed).',
    icon: '🧩',
    category: 'general'
  }
];

/**
 * Generate an auto-dashboard from a natural language prompt
 */
export async function generateAutoDashboard(
  prompt: string,
  schemaContext: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  widgetCount: number = 15,
  onProgress?: (message: string) => void,
  localExecutor?: (sql: string) => Promise<any[]>,
  deps: { apiClient?: ApiClient; passwordStore?: PasswordStore } = {}
): Promise<AutoDashboardResult> {
  
  onProgress?.('🤖 AI is analyzing your request...');
  
  if (!dbConnection && !localExecutor) {
    throw new Error('Please connect to a database first.');
  }
  
  if (!schemaContext) {
    throw new Error('No database schema available. Please ensure tables are selected.');
  }

  // Prepare database connection info
  const dbConnectionInfo = buildDbConnectionInfo(dbConnection, deps.passwordStore);
  const apiClient = deps.apiClient ?? defaultApiClient;
  const capabilityToken = await getCapabilityToken('dashboard.generate', {
    apiClient,
    connectorIds: dbConnection?.id ? [dbConnection.id] : []
  });

  onProgress?.('📊 Generating dashboard structure...');

  try {
    const result = await apiClient.post<{ success: boolean; data: AutoDashboardResult; error?: string }>(
      '/api/generate-dashboard',
      {
        prompt,
        schemaContext,
        apiKey,
        dbConnection: dbConnectionInfo,
        widgetCount
      },
      { headers: { 'x-capability-token': capabilityToken } }
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate dashboard');
    }

    onProgress?.(`✅ Generated ${result.data.widgets.length} widgets!`);
    
    const responseData = result.data as AutoDashboardResult;

    if (!localExecutor) {
      return responseData;
    }

    const widgetsWithLocalData = await Promise.all(
      responseData.widgets.map(async (widget) => {
        if (!widget.sql) {
          return { ...widget, chartData: [], sqlError: 'No SQL generated.' };
        }
        try {
          let chartData = await localExecutor(widget.sql);
          if (chartData.length > 50) {
            chartData = chartData.slice(0, 50);
          }
          chartData = limitChartData(chartData, widget.chartConfig);
          return { ...widget, chartData };
        } catch (err: any) {
          return { ...widget, chartData: [], sqlError: err.message || 'Failed to execute SQL locally.' };
        }
      })
    );

    return {
      ...responseData,
      widgets: widgetsWithLocalData
    };
    
  } catch (error: any) {
    console.error('Auto-dashboard generation error:', error);
    throw error;
  }
}

/**
 * Regenerate a single widget that failed during dashboard generation
 */
export async function regenerateSingleWidget(
  failedWidget: AutoDashboardWidget,
  schemaContext: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  refinementPrompt?: string,
  localExecutor?: (sql: string) => Promise<any[]>,
  deps: { apiClient?: ApiClient; passwordStore?: PasswordStore } = {}
): Promise<AutoDashboardWidget> {
  
  if (!dbConnection && !localExecutor) {
    throw new Error('Database connection required');
  }

  // Prepare database connection info
  const dbConnectionInfo = buildDbConnectionInfo(dbConnection, deps.passwordStore);
  const apiClient = deps.apiClient ?? defaultApiClient;
  const capabilityToken = await getCapabilityToken('dashboard.update', {
    apiClient,
    connectorIds: dbConnection?.id ? [dbConnection.id] : []
  });

  try {
    const result = await apiClient.post<{ success: boolean; data: AutoDashboardWidget; error?: string }>(
      '/api/regenerate-widget',
      {
        widget: failedWidget,
        schemaContext,
        apiKey,
        dbConnection: dbConnectionInfo,
        refinementPrompt,
        originalError: failedWidget.sqlError
      },
      { headers: { 'x-capability-token': capabilityToken } }
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to regenerate widget');
    }

    const regenerated = result.data as AutoDashboardWidget;

    if (!localExecutor || !regenerated.sql) {
      return regenerated;
    }

    try {
      let chartData = await localExecutor(regenerated.sql);
      if (chartData.length > 50) {
        chartData = chartData.slice(0, 50);
      }
      chartData = limitChartData(chartData, regenerated.chartConfig);
      return { ...regenerated, chartData };
    } catch (err: any) {
      return { ...regenerated, chartData: [], sqlError: err.message || 'Failed to execute SQL locally.' };
    }
    
  } catch (error: any) {
    console.error('Widget regeneration error:', error);
    throw error;
  }
}

/**
 * Convert auto-dashboard widgets to DashboardItem format
 */
export function convertToDashboardItems(widgets: AutoDashboardWidget[]): DashboardItem[] {
  return widgets
    .filter(w => w.chartData && w.chartData.length > 0 && !w.sqlError)
    .map((widget, index) => ({
      id: widget.id,
      title: widget.title,
      chartConfig: {
        type: widget.chartConfig.type,
        xAxis: widget.chartConfig.xAxis,
        yAxis: widget.chartConfig.yAxis,
        title: widget.chartConfig.title,
        colorScheme: widget.chartConfig.colorScheme as any || 'default'
      },
      chartData: widget.chartData,
      addedAt: widget.addedAt || Date.now(),
      // Store SQL for potential regeneration
      sql: widget.sql,
      // Use full width for first chart, then alternate between full and half width
      colSpan: index === 0 ? 12 : (index % 3 === 0 ? 12 : 6) as 4 | 6 | 12,
      // Use larger default height for better visibility (600px default)
      height: 600
    }));
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
  switch (category) {
    case 'sales': return '💰';
    case 'finance': return '📈';
    case 'operations': return '⚙️';
    case 'customers': return '👥';
    case 'products': return '📦';
    default: return '📊';
  }
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): AutoDashboardPreset | undefined {
  return DASHBOARD_PRESETS.find(p => p.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: string): AutoDashboardPreset[] {
  return DASHBOARD_PRESETS.filter(p => p.category === category);
}
