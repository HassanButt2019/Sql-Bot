import { Message, DbConnection } from "../types";
import { coerceNumericAxis, deriveCountSeries, fixExcelSql, limitChartData, normalizeChartType, wrapCountByQuery } from "./excelDuckdbService";
import { ApiClient, defaultApiClient } from "./apiClient";
import { buildDbConnectionInfo, PasswordStore } from "./dbConnectionInfo";

export async function queryModel(
  prompt: string, 
  schema: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  onChunk: (text: string) => void,
  localExecutor?: (sql: string) => Promise<any[]>,
  deps: { apiClient?: ApiClient; passwordStore?: PasswordStore; sourceType?: 'excel' | 'sql'; profileData?: any } = {}
): Promise<Partial<Message>> {
  onChunk('Analyzing your query...');
  
  try {
    // Prepare database connection info for SQL execution
    const dbConnectionInfo = buildDbConnectionInfo(dbConnection, deps.passwordStore);
    const apiClient = deps.apiClient ?? defaultApiClient;

    const result = await apiClient.post<{
      success: boolean;
      data: {
        content?: string;
        sql?: string;
        explanation?: string;
        chartConfig?: Message['chartConfig'];
        chartData?: any[];
        sqlError?: string;
      };
      error?: string;
    }>('/api/chat', {
      prompt,
      schemaContext: schema,
      apiKey,
      dbConnection: dbConnectionInfo,
      sourceType: deps.sourceType,
      profileData: deps.profileData
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get response from AI');
    }

    let chartData = result.data.chartData;
    let sqlError = result.data.sqlError;

    if (localExecutor && result.data.sql) {
      try {
        chartData = await localExecutor(result.data.sql);
        if (chartData && chartData.length > 100) {
          chartData = chartData.slice(0, 100);
        }
        chartData = coerceNumericAxis(chartData, result.data.chartConfig?.yAxis);
        result.data.chartConfig = normalizeChartType(chartData, result.data.chartConfig);
        chartData = limitChartData(chartData, result.data.chartConfig);
      } catch (err: any) {
        sqlError = err.message || 'Failed to execute SQL locally.';
        if (deps.sourceType === 'excel') {
          try {
            const fixedSql = fixExcelSql(result.data.sql, schema, result.data.chartConfig);
            chartData = await localExecutor(fixedSql);
            if (chartData && chartData.length > 100) {
              chartData = chartData.slice(0, 100);
            }
            chartData = coerceNumericAxis(chartData, result.data.chartConfig?.yAxis);
            result.data.chartConfig = normalizeChartType(chartData, result.data.chartConfig);
            chartData = limitChartData(chartData, result.data.chartConfig);
            sqlError = null;
            result.data.sql = fixedSql;
          } catch (fixErr: any) {
            sqlError = fixErr.message || sqlError;
          }
        }
      }
    }

    if (deps.sourceType === 'excel' && localExecutor && result.data.sql && result.data.chartConfig?.xAxis) {
      const row = Array.isArray(chartData) && chartData.length > 0 ? chartData[0] : null;
      const yAxis = result.data.chartConfig?.yAxis;
      const hasYAxis = yAxis ? row && Object.prototype.hasOwnProperty.call(row, yAxis) : true;
      if (!chartData || chartData.length === 0 || !hasYAxis) {
        try {
          const countSql = wrapCountByQuery(result.data.sql, result.data.chartConfig.xAxis);
          const counted = await localExecutor(countSql);
          if (counted && counted.length > 0) {
            chartData = coerceNumericAxis(counted, 'value');
            result.data.chartConfig = normalizeChartType(chartData, { ...result.data.chartConfig, yAxis: 'value', type: result.data.chartConfig.type || 'bar' });
            chartData = limitChartData(chartData, result.data.chartConfig);
            result.data.sql = countSql;
            sqlError = null;
          }
        } catch {
          // keep original error if any
        }
      }
    }

    if (deps.sourceType === 'excel' && chartData && chartData.length > 0 && result.data.chartConfig) {
      const yAxis = result.data.chartConfig.yAxis;
      const row = chartData[0];
      const hasYAxis = yAxis ? Object.prototype.hasOwnProperty.call(row, yAxis) : false;
      if (!hasYAxis) {
        const derived = deriveCountSeries(chartData, result.data.chartConfig.xAxis);
        if (derived.rows.length > 0) {
        chartData = coerceNumericAxis(derived.rows, 'value');
          result.data.chartConfig = normalizeChartType(chartData, {
            ...result.data.chartConfig,
            xAxis: derived.xAxis || result.data.chartConfig.xAxis,
            yAxis: 'value',
            type: result.data.chartConfig.type || 'bar'
          });
          sqlError = null;
        }
      }
    }

    // If there was a SQL execution error, include it in the explanation
    let explanation = result.data.explanation;
    if (sqlError) {
      explanation = `${explanation}\n\n⚠️ SQL Execution Error: ${sqlError}`;
    }

    onChunk(result.data.content || 'Analysis complete.');
    
    return {
      content: result.data.content,
      sql: result.data.sql,
      explanation: explanation,
      chartConfig: result.data.chartConfig,
      chartData: chartData,
      sqlError: sqlError
    };
  } catch (error: any) {
    console.error('LLM Router error:', error);
    throw error;
  }
}
