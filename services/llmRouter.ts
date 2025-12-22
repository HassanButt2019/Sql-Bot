import { Message, DbConnection } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function queryModel(
  prompt: string, 
  schema: string,
  apiKey: string,
  dbConnection: DbConnection | null,
  onChunk: (text: string) => void
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

    // If there was a SQL execution error, include it in the explanation
    let explanation = result.data.explanation;
    if (result.data.sqlError) {
      explanation = `${explanation}\n\n⚠️ SQL Execution Error: ${result.data.sqlError}`;
    }

    onChunk(result.data.content || 'Analysis complete.');
    
    return {
      content: result.data.content,
      sql: result.data.sql,
      explanation: explanation,
      chartConfig: result.data.chartConfig,
      chartData: result.data.chartData
    };
  } catch (error: any) {
    console.error('LLM Router error:', error);
    throw error;
  }
}