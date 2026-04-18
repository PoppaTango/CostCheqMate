import Constants from "expo-constants";
import { API_BASE_URL } from "./config";
import {
  clearTokens,
  getAccessToken,
  getOrCreateDeviceId,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./storage";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonRecord = Record<string, JsonValue>;

export interface MobileUser {
  id: string;
  email: string | null;
  name?: string | null;
  role?: string;
  accountType?: string;
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: MobileUser;
}

export interface SyncChangesResponse {
  since: string;
  nextCursor: string;
  serverTime: string;
  changes: JsonRecord;
  mutations: JsonValue[];
}

interface RequestOptions {
  method?: "GET" | "POST";
  accessToken?: string;
  body?: JsonRecord;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    const message =
      typeof json.error === "string" ? json.error : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

async function getAuthMetadata() {
  const deviceId = await getOrCreateDeviceId();
  const appVersion = Constants.expoConfig?.version || "0.1.0";
  return { deviceId, appVersion };
}

export const mobileApi = {
  async login(email: string, password: string): Promise<StoredSession> {
    const { deviceId, appVersion } = await getAuthMetadata();
    const response = await requestJson<{
      accessToken: string;
      refreshToken: string;
      user: MobileUser;
    }>("/api/mobile/auth/login", {
      method: "POST",
      body: {
        email,
        password,
        deviceId,
        platform: "expo",
        appVersion,
      },
    });

    await setAccessToken(response.accessToken);
    await setRefreshToken(response.refreshToken);
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
    };
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { deviceId, appVersion } = await getAuthMetadata();
    const response = await requestJson<{
      accessToken: string;
      refreshToken: string;
    }>("/api/mobile/auth/refresh", {
      method: "POST",
      body: {
        refreshToken,
        deviceId,
        appVersion,
      },
    });

    await setAccessToken(response.accessToken);
    await setRefreshToken(response.refreshToken);
    return response;
  },

  async getMe(accessToken: string): Promise<{ user: MobileUser }> {
    return requestJson<{ user: MobileUser }>("/api/mobile/me", {
      method: "GET",
      accessToken,
    });
  },

  async getSyncChanges(params: {
    accessToken: string;
    since?: string | null;
    limit?: number;
  }): Promise<SyncChangesResponse> {
    const query = new URLSearchParams();
    if (params.since) query.set("since", params.since);
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return requestJson<SyncChangesResponse>(`/api/mobile/sync/changes${suffix}`, {
      method: "GET",
      accessToken: params.accessToken,
    });
  },

  async logout(refreshToken: string): Promise<void> {
    await requestJson<{ success: boolean }>("/api/mobile/auth/logout", {
      method: "POST",
      body: { refreshToken },
    }).catch(() => undefined);
    await clearTokens();
  },

  async tryResumeSession(): Promise<StoredSession | null> {
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();
    if (!accessToken || !refreshToken) {
      return null;
    }

    try {
      const profile = await this.getMe(accessToken);
      return { accessToken, refreshToken, user: profile.user };
    } catch {
      try {
        const refreshed = await this.refreshToken(refreshToken);
        const profile = await this.getMe(refreshed.accessToken);
        return {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          user: profile.user,
        };
      } catch {
        await clearTokens();
        return null;
      }
    }
  },
};
