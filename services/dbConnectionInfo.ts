import { DbConnection } from '../types';

export interface PasswordStore {
  getPassword(connectionId: string): string;
}

export interface DbConnectionInfo {
  id?: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  dialect: string;
  connectionString?: string;
  useConnectionString?: boolean;
}

export const localStoragePasswordStore: PasswordStore = {
  getPassword(connectionId: string): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }
    return localStorage.getItem(`sqlmind_db_password_${connectionId}`) || '';
  }
};

export function buildDbConnectionInfo(
  dbConnection: DbConnection | null,
  passwordStore: PasswordStore = localStoragePasswordStore
): DbConnectionInfo | null {
  if (!dbConnection) {
    return null;
  }

  return {
    id: dbConnection.id,
    host: dbConnection.host,
    port: dbConnection.port,
    username: dbConnection.username,
    password: passwordStore.getPassword(dbConnection.id),
    database: dbConnection.database,
    dialect: dbConnection.dialect,
    connectionString: dbConnection.connectionString,
    useConnectionString: dbConnection.useConnectionString
  };
}
