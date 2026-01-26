import { ApiClient, defaultApiClient } from './apiClient';

interface CapabilityResponse {
  success: boolean;
  data?: {
    token: string;
    expires_in: number;
  };
  error?: string;
}

const capabilityCache = new Map<string, { token: string; expiresAt: number }>();

function cacheKey(action: string, connectorIds: string[] = []): string {
  if (!connectorIds.length) return action;
  return `${action}:${connectorIds.sort().join(',')}`;
}

export async function getCapabilityToken(
  action: string,
  options: { apiClient?: ApiClient; connectorIds?: string[]; datasetAllowlist?: string[] } = {}
): Promise<string> {
  const apiClient = options.apiClient ?? defaultApiClient;
  const connectorIds = options.connectorIds ?? [];
  const key = cacheKey(action, connectorIds);
  const cached = capabilityCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.token;
  }

  const result = await apiClient.post<CapabilityResponse>('/api/capabilities', {
    allowed_actions: [action],
    allowed_connector_ids: connectorIds,
    dataset_allowlist: options.datasetAllowlist ?? []
  });

  if (!result.success || !result.data?.token) {
    throw new Error(result.error || 'Failed to issue capability token.');
  }

  const expiresAt = Date.now() + (result.data.expires_in ?? 300) * 1000;
  capabilityCache.set(key, { token: result.data.token, expiresAt });
  return result.data.token;
}
