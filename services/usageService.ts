import { ApiClient, defaultApiClient } from './apiClient';

export interface UsageLimitsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface AnalyticsSummaryResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

export async function fetchUsageLimits(
  apiClient: ApiClient = defaultApiClient
): Promise<UsageLimitsResponse> {
  return apiClient.post<UsageLimitsResponse>('/api/usage/limits', {});
}

export async function fetchAnalyticsSummary(
  apiClient: ApiClient = defaultApiClient
): Promise<AnalyticsSummaryResponse> {
  return apiClient.post<AnalyticsSummaryResponse>('/api/analytics/summary', {});
}

export async function fetchAuditLogs(
  apiClient: ApiClient = defaultApiClient
): Promise<AuditLogsResponse> {
  return apiClient.post<AuditLogsResponse>('/api/audit', {});
}

export async function updatePlanLimits(
  planId: string,
  payload: Record<string, any>,
  adminToken: string,
  apiClient: ApiClient = defaultApiClient
): Promise<UsageLimitsResponse> {
  return apiClient.post<UsageLimitsResponse>(
    `/api/admin/plans/${planId}`,
    payload,
    {
      headers: {
        'x-admin-token': adminToken
      }
    }
  );
}
