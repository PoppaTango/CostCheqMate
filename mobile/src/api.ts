/* eslint-disable @typescript-eslint/no-explicit-any */
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

export interface CategoryRecord {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  annualBudget?: number;
}

export interface ExpenseRecord {
  id: string;
  amount: number;
  merchant?: string | null;
  description?: string | null;
  date: string;
  categoryId: string;
  category?: CategoryRecord | null;
  receiptUrl?: string | null;
  receiptKey?: string | null;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
  completedAt?: string | null;
}

interface OcrReceiptResponse {
  merchant: string;
  date: string;
  amount: string;
  error?: string;
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

  async listCategories(accessToken: string): Promise<{ categories: CategoryRecord[] }> {
    return requestJson<{ categories: CategoryRecord[] }>("/api/mobile/categories", {
      method: "GET",
      accessToken,
    });
  },

  async listExpenses(
    accessToken: string,
    options?: { categoryId?: string; startDate?: string; endDate?: string }
  ): Promise<{ expenses: ExpenseRecord[] }> {
    const query = new URLSearchParams();
    if (options?.categoryId) query.set("categoryId", options.categoryId);
    if (options?.startDate) query.set("startDate", options.startDate);
    if (options?.endDate) query.set("endDate", options.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return requestJson<{ expenses: ExpenseRecord[] }>(`/api/mobile/expenses${suffix}`, {
      method: "GET",
      accessToken,
    });
  },

  async createExpense(
    accessToken: string,
    payload: {
      amount: number;
      categoryId: string;
      date: string;
      merchant?: string;
      description?: string;
      receiptUrl?: string;
      receiptKey?: string;
    }
  ): Promise<{ expense: ExpenseRecord; cheqsAwarded: number }> {
    return requestJson<{ expense: ExpenseRecord; cheqsAwarded: number }>("/api/mobile/expenses", {
      method: "POST",
      accessToken,
      body: payload,
    });
  },

  async scanReceipt(
    accessToken: string,
    fileName: string,
    contentType: string,
    base64Data: string
  ): Promise<OcrReceiptResponse> {
    return requestJson<OcrReceiptResponse>("/api/mobile/ocr", {
      method: "POST",
      accessToken,
      body: {
        fileName,
        contentType,
        base64Data,
      },
    });
  },

  async createStripeCheckout(
    accessToken: string,
    payload: {
      type: "premium_subscription" | "business_subscription" | "storage_addon" | "donation";
      amount?: number;
      months?: number;
      note?: string;
      storagePlanId?: string;
      returnUrlSuccess?: string;
      returnUrlCancel?: string;
    }
  ): Promise<{ sessionId: string; url: string | null; months?: number; totalAmount?: number }> {
    return requestJson<{ sessionId: string; url: string | null; months?: number; totalAmount?: number }>(
      "/api/mobile/payments/checkout",
      {
        method: "POST",
        accessToken,
        body: payload,
      }
    );
  },

  async getPaymentHistory(
    accessToken: string
  ): Promise<{ payments: PaymentRecord[]; pagination: JsonRecord; totals?: JsonRecord | null }> {
    return requestJson<{ payments: PaymentRecord[]; pagination: JsonRecord; totals?: JsonRecord | null }>(
      "/api/mobile/payments/history",
      {
        method: "GET",
        accessToken,
      }
    );
  },

  async verifyAppleIap(
    accessToken: string,
    payload: {
      receiptData: string;
      productId: string;
      originalTransactionId: string;
      transactionId?: string;
    }
  ): Promise<{ status: string; message: string; expiresAt?: string | null }> {
    return requestJson<{ status: string; message: string; expiresAt?: string | null }>(
      "/api/mobile/payments/apple/verify",
      {
        method: "POST",
        accessToken,
        body: payload,
      }
    );
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
