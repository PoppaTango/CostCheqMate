import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "costcheqmate.mobile.accessToken";
const REFRESH_TOKEN_KEY = "costcheqmate.mobile.refreshToken";
const DEVICE_ID_KEY = "costcheqmate.mobile.deviceId";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
  } | null;
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string) {
  return SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string) {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export async function getOrCreateDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const generated = `device_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

export async function saveSession(session: StoredSession) {
  await Promise.all([
    setAccessToken(session.accessToken),
    setRefreshToken(session.refreshToken),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken, user: null };
}

export async function clearSession() {
  await clearTokens();
}

const SYNC_CURSOR_KEY = "costcheqmate.mobile.syncCursor";

export async function saveSyncCursor(cursor: string) {
  await SecureStore.setItemAsync(SYNC_CURSOR_KEY, cursor);
}

export async function loadSyncCursor() {
  return SecureStore.getItemAsync(SYNC_CURSOR_KEY);
}
