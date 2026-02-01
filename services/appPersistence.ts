import { Conversation, DashboardReport, DbConnection } from '../types';
import { safeStringify } from '../utils/json';

const STORAGE_KEYS = {
  conversations: 'sqlmind_conversations_v3',
  dashboards: 'sqlmind_dashboards_v3',
  connections: 'sqlmind_connections_v3',
  integrationHistory: 'sqlmind_integration_history',
  integrationAnalytics: 'sqlmind_integration_analytics',
  integrationStatuses: 'sqlmind_integration_statuses'
} as const;

function scopedKey(key: string, userId?: string | null): string {
  if (!userId) return key;
  return `${key}:${userId}`;
}

function readJson<T>(key: string, userId?: string | null): T | null {
  const raw = localStorage.getItem(scopedKey(key, userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadPersistedConversations(userId?: string | null): Conversation[] {
  return readJson<Conversation[]>(STORAGE_KEYS.conversations, userId) ?? [];
}

export function loadPersistedDashboards(userId?: string | null): DashboardReport[] {
  return readJson<DashboardReport[]>(STORAGE_KEYS.dashboards, userId) ?? [];
}

export function loadPersistedConnections(userId?: string | null): DbConnection[] {
  return readJson<DbConnection[]>(STORAGE_KEYS.connections, userId) ?? [];
}

export function savePersistedAppState(
  conversations: Conversation[],
  dashboards: DashboardReport[],
  connections: DbConnection[],
  userId?: string | null
): void {
  localStorage.setItem(scopedKey(STORAGE_KEYS.conversations, userId), safeStringify(conversations));
  localStorage.setItem(scopedKey(STORAGE_KEYS.dashboards, userId), safeStringify(dashboards));
  const persistedConnections = connections.filter(connection => !connection.isTemporary);
  localStorage.setItem(scopedKey(STORAGE_KEYS.connections, userId), safeStringify(persistedConnections));
}

export function loadIntegrationState(): {
  history: { id: string; name: string; connectedAt: number }[];
  analyticsIntegrationIds: string[];
  statuses: Record<string, 'available' | 'connected'>;
} {
  return {
    history: readJson<{ id: string; name: string; connectedAt: number }[]>(STORAGE_KEYS.integrationHistory) ?? [],
    analyticsIntegrationIds: readJson<string[]>(STORAGE_KEYS.integrationAnalytics) ?? [],
    statuses: readJson<Record<string, 'available' | 'connected'>>(STORAGE_KEYS.integrationStatuses) ?? {}
  };
}

export function saveIntegrationState(
  history: { id: string; name: string; connectedAt: number }[],
  analyticsIntegrationIds: string[],
  statuses: Record<string, 'available' | 'connected'>
): void {
  localStorage.setItem(STORAGE_KEYS.integrationHistory, JSON.stringify(history));
  localStorage.setItem(STORAGE_KEYS.integrationAnalytics, JSON.stringify(analyticsIntegrationIds));
  localStorage.setItem(STORAGE_KEYS.integrationStatuses, JSON.stringify(statuses));
}

export function loadIntegrationStateForUser(userId?: string | null): {
  history: { id: string; name: string; connectedAt: number }[];
  analyticsIntegrationIds: string[];
  statuses: Record<string, 'available' | 'connected'>;
} {
  return {
    history: readJson<{ id: string; name: string; connectedAt: number }[]>(STORAGE_KEYS.integrationHistory, userId) ?? [],
    analyticsIntegrationIds: readJson<string[]>(STORAGE_KEYS.integrationAnalytics, userId) ?? [],
    statuses: readJson<Record<string, 'available' | 'connected'>>(STORAGE_KEYS.integrationStatuses, userId) ?? {}
  };
}

export function saveIntegrationStateForUser(
  history: { id: string; name: string; connectedAt: number }[],
  analyticsIntegrationIds: string[],
  statuses: Record<string, 'available' | 'connected'>,
  userId?: string | null
): void {
  localStorage.setItem(scopedKey(STORAGE_KEYS.integrationHistory, userId), JSON.stringify(history));
  localStorage.setItem(scopedKey(STORAGE_KEYS.integrationAnalytics, userId), JSON.stringify(analyticsIntegrationIds));
  localStorage.setItem(scopedKey(STORAGE_KEYS.integrationStatuses, userId), JSON.stringify(statuses));
}
