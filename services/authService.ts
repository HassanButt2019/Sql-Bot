import { ApiClient, defaultApiClient } from './apiClient';

export interface AuthResponse {
  success: boolean;
  data?: { user: any; token?: string };
  error?: string;
}

export async function registerUser(
  payload: { email: string; password: string; name?: string; company?: string; role?: string },
  apiClient: ApiClient = defaultApiClient
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/register', payload);
}

export async function loginUser(
  payload: { email: string; password: string },
  apiClient: ApiClient = defaultApiClient
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/login', payload);
}

export async function fetchCurrentUser(
  apiClient: ApiClient = defaultApiClient
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/me', {});
}

export async function updateProfile(
  payload: { name?: string; company?: string; role?: string },
  apiClient: ApiClient = defaultApiClient
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/profile', payload);
}

export function storeAuthToken(token: string) {
  localStorage.setItem('sqlmind_auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('sqlmind_auth_token');
}
