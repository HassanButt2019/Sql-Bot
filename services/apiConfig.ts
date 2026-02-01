export const DEFAULT_API_BASE_URL = 'http://localhost:3001';

type ViteEnv = {
  VITE_API_URL?: string;
};

export function getApiBaseUrl(env: ViteEnv | undefined = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined)): string {
  const baseUrl = env?.VITE_API_URL;
  if (baseUrl && baseUrl.trim().length > 0) {
    return baseUrl.trim();
  }
  if (env?.DEV) {
    return '';
  }
  return DEFAULT_API_BASE_URL;
}
