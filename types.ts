export type LLMModel = 'gemini-3-pro' | 'gemini-3-flash' | 'claude-3-5' | 'gpt-4o';
export type DbDialect = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite';

export interface TableInfo {
  name: string;
  schema: string;
  selected: boolean;
}

export interface DbConnection {
  id: string;
  name: string;
  host: string;
  port: string;
  username: string;
  database: string;
  dialect: DbDialect;
  tables: TableInfo[];
  isActive: boolean;
  status: 'connected' | 'error' | 'disconnected';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sql?: string;
  explanation?: string;
  chartData?: any[];
  chartConfig?: {
    type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'composed';
    xAxis: string;
    yAxis: string;
    yAxisSecondary?: string; // For composed charts
    title: string;
    colorScheme?: 'default' | 'performance' | 'categorical' | 'warm' | 'cool' | 'trust' | 'growth' | 'alert';
    customColors?: string[];
    showLabels?: boolean;
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
}

export interface DashboardReport {
  id: string;
  title: string;
  items: DashboardItem[];
  createdAt: number;
  updatedAt: number;
}
