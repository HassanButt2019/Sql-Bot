import { DashboardItem, DbConnection } from '../types';
import { limitChartData } from './excelDuckdbService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface DashboardChatWidget {
  title: string;
  sql: string;
  explanation: string;
  chartConfig: {
    type: string;
    xAxis: string;
    yAxis: string;
    title: string;
    colorScheme?: string;
  };
  chartData: any[];
  sqlError?: string;
}

export interface DashboardChatResponse {
  summary: string;
  widgets: DashboardChatWidget[];
}

export async function queryDashboardChat(
  prompt: string,
  schemaContext: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  dashboardItems: DashboardItem[],
  localExecutor?: (sql: string) => Promise<any[]>
): Promise<DashboardChatResponse> {
  const dbConnectionInfo = dbConnection ? {
    host: dbConnection.host,
    port: dbConnection.port,
    username: dbConnection.username,
    password: localStorage.getItem(`sqlmind_db_password_${dbConnection.id}`) || '',
    database: dbConnection.database,
    dialect: dbConnection.dialect,
    connectionString: dbConnection.connectionString,
    useConnectionString: dbConnection.useConnectionString
  } : null;

  const response = await fetch(`${API_BASE_URL}/api/dashboard-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      schemaContext,
      apiKey,
      dbConnection: dbConnectionInfo,
      dashboardItems: dashboardItems.map(item => ({
        title: item.title,
        sql: item.sql,
        chartConfig: item.chartConfig
      }))
    })
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to get dashboard chat response');
  }

  const responseData = result.data as DashboardChatResponse;

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
        if (chartData.length > 100) {
          chartData = chartData.slice(0, 100);
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
}
