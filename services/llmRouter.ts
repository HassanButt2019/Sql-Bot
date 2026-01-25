import { Message, DbConnection } from "../types";
import { limitChartData } from "./excelDuckdbService";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function queryModel(
  prompt: string, 
  schema: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  onChunk: (text: string) => void,
  localExecutor?: (sql: string) => Promise<any[]>
): Promise<Partial<Message>> {
  onChunk('Analyzing your query...');
  
  try {
    // Prepare database connection info for SQL execution
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

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        schemaContext: schema,
        apiKey,
        dbConnection: dbConnectionInfo
      }),
    });

    const result = await response.json();
    
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
