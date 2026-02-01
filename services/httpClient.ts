export interface HttpClient {
  postJson<T>(url: string, body: unknown, init?: RequestInit): Promise<T>;
}

export function createFetchHttpClient(fetchFn: typeof fetch = fetch): HttpClient {
  return {
    async postJson<T>(url: string, body: unknown, init: RequestInit = {}): Promise<T> {
      const { headers, ...rest } = init;
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(headers ?? {})
        },
        body: JSON.stringify(body),
        ...rest
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Non-JSON response received');
      }
      return response.json() as Promise<T>;
    }
  };
}
