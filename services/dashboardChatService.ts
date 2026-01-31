import { ChartConfig, DashboardItem, DbConnection } from '../types';
import { coerceNumericAxis, deriveCountSeries, fixExcelSql, limitChartData, normalizeChartType, wrapCountByQuery } from './excelDuckdbService';
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
  deps: { apiClient?: ApiClient; passwordStore?: PasswordStore; sourceType?: 'excel' | 'sql'; profileData?: any } = {}
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
      sourceType: deps.sourceType,
      profileData: deps.profileData,
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
        chartData = coerceNumericAxis(chartData, widget.chartConfig?.yAxis);
        const normalizedConfig = normalizeChartType(chartData, widget.chartConfig);
        chartData = limitChartData(chartData, normalizedConfig);
        if (deps.sourceType === 'excel') {
          const row = chartData?.[0];
          const yAxis = widget.chartConfig?.yAxis;
          const hasYAxis = yAxis ? row && Object.prototype.hasOwnProperty.call(row, yAxis) : true;
          if (!chartData || chartData.length === 0 || !hasYAxis) {
            const countSql = wrapCountByQuery(widget.sql, widget.chartConfig?.xAxis);
            const counted = await localExecutor(countSql);
            if (counted && counted.length > 0) {
              const nextChartData = limitChartData(coerceNumericAxis(counted, 'value'), normalizeChartType(counted, { ...widget.chartConfig, yAxis: 'value', type: widget.chartConfig?.type || 'bar' }));
              return { ...widget, sql: countSql, chartData: nextChartData, chartConfig: normalizeChartType(nextChartData, { ...widget.chartConfig, yAxis: 'value', type: widget.chartConfig?.type || 'bar' }) };
            }
          }
          if (chartData && chartData.length > 0 && !hasYAxis) {
            const derived = deriveCountSeries(chartData, widget.chartConfig?.xAxis);
            if (derived.rows.length > 0) {
              const nextChartData = limitChartData(coerceNumericAxis(derived.rows, 'value'), normalizeChartType(derived.rows, { ...widget.chartConfig, yAxis: 'value' }));
              return { ...widget, chartData: nextChartData, chartConfig: normalizeChartType(nextChartData, { ...widget.chartConfig, xAxis: derived.xAxis || widget.chartConfig?.xAxis, yAxis: 'value', type: widget.chartConfig?.type || 'bar' }) };
            }
          }
        }
        return { ...widget, chartData };
      } catch (err: any) {
        if (deps.sourceType === 'excel') {
          try {
            const fixedSql = fixExcelSql(widget.sql, schemaContext, widget.chartConfig);
            let chartData = await localExecutor(fixedSql);
            if (chartData.length > 100) {
              chartData = chartData.slice(0, 100);
            }
            chartData = coerceNumericAxis(chartData, widget.chartConfig?.yAxis);
            const normalizedConfig = normalizeChartType(chartData, widget.chartConfig);
            chartData = limitChartData(chartData, normalizedConfig);
            const row = chartData?.[0];
            const yAxis = widget.chartConfig?.yAxis;
            const hasYAxis = yAxis ? row && Object.prototype.hasOwnProperty.call(row, yAxis) : true;
            if (!chartData || chartData.length === 0 || !hasYAxis) {
              const countSql = wrapCountByQuery(fixedSql, widget.chartConfig?.xAxis);
              const counted = await localExecutor(countSql);
              if (counted && counted.length > 0) {
                const nextChartData = limitChartData(coerceNumericAxis(counted, 'value'), normalizeChartType(counted, { ...widget.chartConfig, yAxis: 'value', type: widget.chartConfig?.type || 'bar' }));
                return { ...widget, sql: countSql, chartData: nextChartData, chartConfig: normalizeChartType(nextChartData, { ...widget.chartConfig, yAxis: 'value', type: widget.chartConfig?.type || 'bar' }) };
              }
            }
            if (chartData && chartData.length > 0 && !hasYAxis) {
              const derived = deriveCountSeries(chartData, widget.chartConfig?.xAxis);
              if (derived.rows.length > 0) {
                const nextChartData = limitChartData(coerceNumericAxis(derived.rows, 'value'), normalizeChartType(derived.rows, { ...widget.chartConfig, yAxis: 'value' }));
                return { ...widget, sql: fixedSql, chartData: nextChartData, chartConfig: normalizeChartType(nextChartData, { ...widget.chartConfig, xAxis: derived.xAxis || widget.chartConfig?.xAxis, yAxis: 'value', type: widget.chartConfig?.type || 'bar' }) };
              }
            }
            return { ...widget, sql: fixedSql, chartData, sqlError: undefined };
          } catch (fixErr: any) {
            return { ...widget, chartData: [], sqlError: fixErr.message || err.message || 'Failed to execute SQL locally.' };
          }
        }
        return { ...widget, chartData: [], sqlError: err.message || 'Failed to execute SQL locally.' };
      }
    })
  );

  return {
    ...responseData,
    widgets: widgetsWithLocalData
  };
}
