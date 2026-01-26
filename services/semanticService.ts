import { ApiClient, defaultApiClient } from './apiClient';

export interface SemanticAgentRequest {
  schemaContext: string;
  apiKey?: string;
  sourceId?: string;
  sourceType?: 'sql' | 'excel' | 'nosql' | 'unknown';
  profileData?: Record<string, any>;
  dbConnection?: Record<string, any> | null;
}

export interface SemanticAgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function requestSemanticAgent(
  payload: SemanticAgentRequest,
  apiClient: ApiClient = defaultApiClient
): Promise<SemanticAgentResponse> {
  return apiClient.post<SemanticAgentResponse>('/api/semantic/agent', payload);
}

export interface SemanticProfileResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function fetchSemanticProfile(
  payload: { schemaContext: string; sourceId?: string },
  apiClient: ApiClient = defaultApiClient
): Promise<SemanticProfileResponse> {
  return apiClient.post<SemanticProfileResponse>('/api/semantic/profile', payload);
}

export async function upsertSemanticMappings(
  payload: { schemaContext: string; table: string; mappings: Record<string, string>; sourceId?: string },
  apiClient: ApiClient = defaultApiClient
): Promise<SemanticProfileResponse> {
  return apiClient.post<SemanticProfileResponse>('/api/semantic/custom-mappings', payload);
}

export async function confirmSemanticMappings(
  payload: { schemaContext: string; confirmations: Array<Record<string, any>>; sourceId?: string },
  apiClient: ApiClient = defaultApiClient
): Promise<SemanticProfileResponse> {
  return apiClient.post<SemanticProfileResponse>('/api/semantic/confirm-mappings', payload);
}
