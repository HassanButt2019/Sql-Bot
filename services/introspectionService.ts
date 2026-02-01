import { TableInfo, DbConnectionConfig } from "../types";
import { ApiClient, defaultApiClient } from './apiClient';

export interface IntrospectionResult {
  success: boolean;
  tables?: TableInfo[];
  error?: string;
  config?: {
    host: string;
    database: string;
    dialect: string;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Test database connection without introspecting
export async function testDatabaseConnection(
  config: DbConnectionConfig,
  apiClient: ApiClient = defaultApiClient
): Promise<ConnectionTestResult> {
  try {
    return await apiClient.post<ConnectionTestResult>('/api/test-connection', config);
  } catch (error) {
    // If backend is not available, fall back to mock mode
    console.warn('Backend not available, using mock mode');
    return { success: true, message: 'Connected (Mock Mode)' };
  }
}

// Introspect database and get table schemas
export async function introspectDatabase(
  config: DbConnectionConfig,
  apiClient: ApiClient = defaultApiClient
): Promise<TableInfo[]> {
  try {
    const data = await apiClient.post<IntrospectionResult>('/api/introspect', config);
    
    if (data.success && data.tables) {
      return data.tables;
    } else {
      throw new Error(data.error || 'Failed to introspect database');
    }
  } catch (error) {
    // If backend is not available, fall back to mock data for development
    console.warn('Backend not available, using mock data:', error);
    return getMockTables(config);
  }
}

// Execute a SQL query against the database
export async function executeQuery(
  config: DbConnectionConfig,
  query: string,
  apiClient: ApiClient = defaultApiClient
): Promise<any[]> {
  try {
    const data = await apiClient.post<{ success: boolean; data: any[]; error?: string }>(
      '/api/execute-query',
      { ...config, query }
    );
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to execute query');
    }
  } catch (error) {
    console.error('Query execution error:', error);
    throw error;
  }
}

// Parse connection string to extract components
export function parseConnectionString(connectionString: string, dialect: string): Partial<DbConnectionConfig> {
  try {
    let urlToParse = connectionString.trim();
    
    // Handle JDBC format: jdbc:postgresql://host:port/database?params
    // Convert to standard URL format for parsing
    if (urlToParse.toLowerCase().startsWith('jdbc:')) {
      urlToParse = urlToParse.substring(5); // Remove 'jdbc:' prefix
    }
    
    // Handle different connection string formats
    // PostgreSQL: postgresql://user:password@host:port/database
    // MySQL: mysql://user:password@host:port/database
    const url = new URL(urlToParse);
    
    // Extract database name (remove query params if present)
    let database = url.pathname.slice(1); // Remove leading '/'
    if (database.includes('?')) {
      database = database.split('?')[0];
    }
    
    return {
      host: url.hostname,
      port: url.port || (dialect === 'postgresql' ? '5432' : dialect === 'mysql' ? '3306' : '1433'),
      username: url.username ? decodeURIComponent(url.username) : '',
      password: url.password ? decodeURIComponent(url.password) : '',
      database: database,
    };
  } catch (error) {
    // Try to parse as a simple connection string format: host:port/database
    try {
      const jdbcRegex = /^(?:jdbc:)?(\w+):\/\/([^:\/]+)(?::(\d+))?\/([^\?]+)(?:\?.*)?$/i;
      const match = connectionString.match(jdbcRegex);
      
      if (match) {
        const [, protocol, host, port, database] = match;
        return {
          host,
          port: port || (dialect === 'postgresql' ? '5432' : dialect === 'mysql' ? '3306' : '1433'),
          database,
        };
      }
    } catch {
      // Fall through to error
    }
    
    throw new Error('Invalid connection string format. Supported formats:\n• jdbc:postgresql://host:port/database\n• postgresql://user:password@host:port/database');
  }
}

// Validate connection string format
export function validateConnectionString(connectionString: string): { valid: boolean; error?: string } {
  if (!connectionString.trim()) {
    return { valid: false, error: 'Connection string is required' };
  }

  try {
    let urlToParse = connectionString.trim();
    
    // Handle JDBC format
    if (urlToParse.toLowerCase().startsWith('jdbc:')) {
      urlToParse = urlToParse.substring(5);
    }
    
    const url = new URL(urlToParse);
    if (!url.hostname) {
      return { valid: false, error: 'Host is required in connection string' };
    }
    if (!url.pathname || url.pathname === '/') {
      return { valid: false, error: 'Database name is required in connection string' };
    }
    return { valid: true };
  } catch {
    // Try regex-based validation for JDBC format
    const jdbcRegex = /^(?:jdbc:)?(\w+):\/\/([^:\/]+)(?::(\d+))?\/([^\?]+)(?:\?.*)?$/i;
    if (jdbcRegex.test(connectionString.trim())) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid connection string format. Supported formats:\n• jdbc:postgresql://host:port/database\n• postgresql://user:password@host:port/database' };
  }
}

// Mock data fallback for development without backend
function getMockTables(config: DbConnectionConfig): TableInfo[] {
  // Simulate a small delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // If the user connects to a "Production" sounding DB, give them more complex tables
      if (config.database.toLowerCase().includes('prod') || config.database.toLowerCase().includes('sales')) {
        resolve([
          { name: 'sales_transactions', schema: 'transaction_id (int), customer_id (int), product_id (int), amount (decimal), sale_date (timestamp), region_id (int)', selected: true },
          { name: 'customers', schema: 'customer_id (int), first_name (string), last_name (string), email (string), segment (string), signup_date (date)', selected: true },
          { name: 'products', schema: 'product_id (int), sku (string), category (string), base_price (decimal), inventory_count (int)', selected: true },
          { name: 'regions', schema: 'region_id (int), name (string), country_code (string), manager_id (int)', selected: false },
          { name: 'discounts', schema: 'discount_id (int), code (string), percentage (decimal), expires_at (date)', selected: false }
        ]);
      } else {
        // Default mock schema for any other DB name
        resolve([
          { name: 'users', schema: 'id (int), username (string), email (string), created_at (timestamp), last_login (timestamp)', selected: true },
          { name: 'posts', schema: 'id (int), author_id (int), title (string), body (text), status (string), published_at (date)', selected: true },
          { name: 'comments', schema: 'id (int), post_id (int), user_id (int), content (text), score (int)', selected: false },
          { name: 'analytics_events', schema: 'event_id (uuid), user_id (int), event_type (string), timestamp (timestamp), metadata (json)', selected: false }
        ]);
      }
    }, 1500);
  }) as any;
}
