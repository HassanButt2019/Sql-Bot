import { getApiBaseUrl } from './apiConfig';
import { createFetchHttpClient, HttpClient } from './httpClient';

export interface ApiClient {
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
}

export interface ApiClientOptions {
  baseUrl?: string;
  httpClient?: HttpClient;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? getApiBaseUrl());
  const httpClient = options.httpClient ?? createFetchHttpClient();

  return {
    post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
      const url = `${baseUrl}${normalizePath(path)}`;
      const headers = { ...(init?.headers || {}) } as Record<string, string>;
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('sqlmind_auth_token');
        if (token && !headers['Authorization']) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      return httpClient.postJson<T>(url, body, { ...init, headers });
    }
  };
}

export const defaultApiClient = createApiClient();
