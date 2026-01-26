import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../services/apiClient';
import type { HttpClient } from '../services/httpClient';

test('api client normalizes base url and path', async () => {
  let capturedUrl = '';
  let capturedBody: unknown = null;

  const httpClient: HttpClient = {
    async postJson(url, body) {
      capturedUrl = url;
      capturedBody = body;
      return { ok: true };
    }
  };

  const apiClient = createApiClient({ baseUrl: 'http://localhost:3001/', httpClient });
  await apiClient.post('/api/test', { hello: 'world' });

  assert.equal(capturedUrl, 'http://localhost:3001/api/test');
  assert.deepEqual(capturedBody, { hello: 'world' });
});
