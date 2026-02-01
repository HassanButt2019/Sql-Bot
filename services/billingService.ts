import { ApiClient, defaultApiClient } from './apiClient';

export interface BillingStatus {
  subscription: {
    plan_id: string;
    status: string;
    interval?: string;
    current_period_end?: number;
    cancel_at_period_end?: number;
  } | null;
}

export async function getBillingStatus(apiClient: ApiClient = defaultApiClient) {
  return apiClient.post<{ success: boolean; data: BillingStatus; error?: string }>('/api/billing/status', {});
}

export async function createCheckoutSession(
  planId: string,
  interval: 'month' | 'year',
  apiClient: ApiClient = defaultApiClient
) {
  return apiClient.post<{ success: boolean; data?: { url: string }; error?: string }>(
    '/api/billing/checkout',
    { planId, interval }
  );
}

export async function createPortalSession(apiClient: ApiClient = defaultApiClient) {
  return apiClient.post<{ success: boolean; data?: { url: string }; error?: string }>(
    '/api/billing/portal',
    {}
  );
}
