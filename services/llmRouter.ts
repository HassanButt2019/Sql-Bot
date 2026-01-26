import { Message, DbConnection } from "../types";
import { limitChartData } from "./excelDuckdbService";
import { ApiClient, defaultApiClient } from "./apiClient";
import { buildDbConnectionInfo, PasswordStore } from "./dbConnectionInfo";

export async function queryModel(
  prompt: string, 
  schema: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  onChunk: (text: string) => void,
  localExecutor?: (sql: string) => Promise<any[]>,
  deps: { apiClient?: ApiClient; passwordStore?: PasswordStore } = {}
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
      dbConnection: dbConnectionInfo
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
        chartData = limitChartData(chartData, result.data.chartConfig);
      } catch (err: any) {
        sqlError = err.message || 'Failed to execute SQL locally.';
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
