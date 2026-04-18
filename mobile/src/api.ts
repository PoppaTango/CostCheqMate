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
  bankAccountId?: string | null;
  cloudFolderId?: string | null;
  cloudFolderName?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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

export interface CategoryCreatePayload {
  name: string;
  icon?: string;
  color?: string;
  annualBudget?: number;
  bankAccountId?: string;
}

interface OcrReceiptResponse {
  merchant: string;
  date: string;
  amount: string;
  error?: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  accessToken?: string;
  body?: JsonRecord;
}

export interface CloudConnectionRecord {
  id: string;
  provider: "onedrive" | "googledrive" | string;
  accountEmail?: string | null;
  accountName?: string | null;
  isActive: boolean;
  yearFolderId?: string | null;
  yearFolderName?: string | null;
  connectedAt: string;
  lastUsed: string;
}

export interface CloudFolderRecord {
  id: string;
  name: string;
}

export interface CloudYearFolderStatus {
  connected: boolean;
  provider: "onedrive" | "googledrive" | string | null;
  yearFolderId: string | null;
  yearFolderName: string | null;
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

  async createCategory(
    accessToken: string,
    payload: CategoryCreatePayload
  ): Promise<{ category: CategoryRecord }> {
    return requestJson<{ category: CategoryRecord }>("/api/mobile/categories", {
      method: "POST",
      accessToken,
      body: payload as unknown as JsonRecord,
    });
  },

  async updateCategory(
    accessToken: string,
    categoryId: string,
    payload: Partial<CategoryCreatePayload> & {
      cloudFolderId?: string | null;
      cloudFolderName?: string | null;
    }
  ): Promise<{ category: CategoryRecord }> {
    return requestJson<{ category: CategoryRecord }>(`/api/mobile/categories/${categoryId}`, {
      method: "PUT",
      accessToken,
      body: payload as unknown as JsonRecord,
    });
  },

  async deleteCategory(accessToken: string, categoryId: string): Promise<{ success: boolean }> {
    return requestJson<{ success: boolean }>(`/api/mobile/categories/${categoryId}`, {
      method: "DELETE",
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

  async updateExpense(
    accessToken: string,
    expenseId: string,
    payload: {
      amount?: number;
      categoryId?: string;
      date?: string;
      merchant?: string;
      description?: string;
      receiptUrl?: string | null;
      receiptKey?: string | null;
    }
  ): Promise<{ expense: ExpenseRecord }> {
    return requestJson<{ expense: ExpenseRecord }>(`/api/mobile/expenses/${expenseId}`, {
      method: "PUT",
      accessToken,
      body: payload as unknown as JsonRecord,
    });
  },

  async deleteExpense(accessToken: string, expenseId: string): Promise<{ success: boolean }> {
    return requestJson<{ success: boolean }>(`/api/mobile/expenses/${expenseId}`, {
      method: "DELETE",
      accessToken,
    });
  },

  async scanReceipt(
    accessToken: string,
    fileName: string,
    contentType: string,
    base64Data: string
  ): Promise<OcrReceiptResponse> {
    const receiptText = `file:${fileName};type:${contentType};base64:${base64Data.slice(0, 4000)}`;
    return requestJson<OcrReceiptResponse>("/api/mobile/ocr", {
      method: "POST",
      accessToken,
      body: {
        receiptText,
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
      transactionId: string;
      originalTransactionId?: string;
      isSandbox?: boolean;
      appAccountToken?: string;
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

  async getCloudStatus(
    accessToken: string
  ): Promise<{ connections: CloudConnectionRecord[] }> {
    return requestJson<{ connections: CloudConnectionRecord[] }>(
      "/api/mobile/cloud-storage/status",
      {
        method: "GET",
        accessToken,
      }
    );
  },

  async createCloudConnectLink(
    accessToken: string,
    provider: "onedrive" | "googledrive"
  ): Promise<{ authUrl: string; state: string; provider: string }> {
    return requestJson<{ authUrl: string; state: string; provider: string }>(
      "/api/mobile/cloud-storage/connect",
      {
        method: "POST",
        accessToken,
        body: { provider },
      }
    );
  },

  async disconnectCloudProvider(
    accessToken: string,
    provider: "onedrive" | "googledrive"
  ): Promise<{ success: boolean }> {
    return requestJson<{ success: boolean }>("/api/mobile/cloud-storage/disconnect", {
      method: "POST",
      accessToken,
      body: { provider },
    });
  },

  async listCloudFolders(
    accessToken: string,
    options?: { browse?: boolean; parentId?: string }
  ): Promise<{
    connected: boolean;
    provider?: "onedrive" | "googledrive" | string;
    folders: CloudFolderRecord[];
  }> {
    const query = new URLSearchParams();
    if (options?.browse) query.set("browse", "true");
    if (options?.parentId) query.set("parentId", options.parentId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return requestJson<{
      connected: boolean;
      provider?: "onedrive" | "googledrive" | string;
      folders: CloudFolderRecord[];
    }>(`/api/mobile/cloud-storage/folders${suffix}`, {
      method: "GET",
      accessToken,
    });
  },

  async createCloudFolder(
    accessToken: string,
    folderName: string
  ): Promise<{ folder: CloudFolderRecord }> {
    return requestJson<{ folder: CloudFolderRecord }>("/api/mobile/cloud-storage/folders", {
      method: "POST",
      accessToken,
      body: { folderName },
    });
  },

  async getCloudYearFolder(accessToken: string): Promise<CloudYearFolderStatus> {
    return requestJson<CloudYearFolderStatus>("/api/mobile/cloud-storage/year-folder", {
      method: "GET",
      accessToken,
    });
  },

  async setCloudYearFolder(
    accessToken: string,
    payload: { yearFolderId: string | null; yearFolderName: string | null }
  ): Promise<{ success: boolean; yearFolderId: string | null; yearFolderName: string | null }> {
    return requestJson<{
      success: boolean;
      yearFolderId: string | null;
      yearFolderName: string | null;
    }>("/api/mobile/cloud-storage/year-folder", {
      method: "PUT",
      accessToken,
      body: payload,
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
