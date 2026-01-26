import test from 'node:test';
import assert from 'node:assert/strict';
import { getApiBaseUrl, DEFAULT_API_BASE_URL } from '../services/apiConfig';

test('getApiBaseUrl returns default when env missing', () => {
  assert.equal(getApiBaseUrl(undefined), DEFAULT_API_BASE_URL);
});

test('getApiBaseUrl prefers VITE_API_URL when provided', () => {
  assert.equal(getApiBaseUrl({ VITE_API_URL: 'http://example.com' }), 'http://example.com');
});

test('getApiBaseUrl falls back when VITE_API_URL is blank', () => {
  assert.equal(getApiBaseUrl({ VITE_API_URL: '   ' }), DEFAULT_API_BASE_URL);
});
