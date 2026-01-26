import { ChartConfig, DashboardItem, DbConnection } from '../types';
import { limitChartData } from './excelDuckdbService';
import { ApiClient, defaultApiClient } from './apiClient';
import { buildDbConnectionInfo, PasswordStore } from './dbConnectionInfo';
import { getCapabilityToken } from './capabilitiesService';

export interface DashboardChatWidget {
  title: string;
  sql: string;
  explanation: string;
  chartConfig: ChartConfig;
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
  localExecutor?: (sql: string) => Promise<any[]>,
  deps: { apiClient?: ApiClient; passwordStore?: PasswordStore } = {}
): Promise<DashboardChatResponse> {
  const dbConnectionInfo = buildDbConnectionInfo(dbConnection, deps.passwordStore);
  const apiClient = deps.apiClient ?? defaultApiClient;
  const capabilityToken = await getCapabilityToken('dashboard.update', {
    apiClient,
    connectorIds: dbConnection?.id ? [dbConnection.id] : []
  });

  const result = await apiClient.post<{ success: boolean; data: DashboardChatResponse; error?: string }>(
    '/api/dashboard-chat',
    {
      prompt,
      schemaContext,
      apiKey,
      dbConnection: dbConnectionInfo,
      dashboardItems: dashboardItems.map(item => ({
        title: item.title,
        sql: item.sql,
        chartConfig: item.chartConfig
      }))
    },
    { headers: { 'x-capability-token': capabilityToken } }
  );
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
