import { ApiClient, defaultApiClient } from './apiClient';

let initialized = false;

export function initErrorReporting(apiClient: ApiClient = defaultApiClient) {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      message: event.message,
      stack: event.error?.stack,
      source: 'window.error',
      url: window.location.href,
      meta: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    }, apiClient);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      message: typeof reason === 'string' ? reason : (reason?.message || 'Unhandled rejection'),
      stack: reason?.stack,
      source: 'window.unhandledrejection',
      url: window.location.href
    }, apiClient);
  });
}

function reportClientError(payload: Record<string, any>, apiClient: ApiClient) {
  const safePayload = {
    ...payload,
    userAgent: navigator.userAgent
  };
  apiClient.post('/api/client-error', safePayload).catch(() => null);
}
