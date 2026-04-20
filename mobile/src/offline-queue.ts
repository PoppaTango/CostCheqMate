import * as SecureStore from "expo-secure-store";
import { mobileApi } from "./api";

const OFFLINE_QUEUE_KEY = "costcheqmate.mobile.offlineQueue";

export type OfflineMutationType =
  | "create_expense"
  | "update_expense"
  | "delete_expense"
  | "create_category"
  | "update_category"
  | "delete_category";

export type OfflineQueueItem = {
  id: string;
  type: OfflineMutationType;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

function makeQueueId() {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function loadQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: OfflineQueueItem[]) {
  await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(items));
}

export async function getOfflineQueue() {
  return loadQueue();
}

export async function enqueueOfflineMutation(input: {
  type: OfflineMutationType;
  payload: Record<string, unknown>;
}) {
  const queue = await loadQueue();
  queue.push({
    id: makeQueueId(),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await saveQueue(queue);
  return queue.length;
}

async function applyQueueItem(accessToken: string, item: OfflineQueueItem) {
  switch (item.type) {
    case "create_expense":
      await mobileApi.createExpense(
        accessToken,
        item.payload as Parameters<typeof mobileApi.createExpense>[1]
      );
      return;
    case "update_expense":
      await mobileApi.updateExpense(
        accessToken,
        String(item.payload.expenseId || ""),
        (item.payload.data || {}) as Parameters<typeof mobileApi.updateExpense>[2]
      );
      return;
    case "delete_expense":
      await mobileApi.deleteExpense(accessToken, String(item.payload.expenseId || ""));
      return;
    case "create_category":
      await mobileApi.createCategory(
        accessToken,
        item.payload as unknown as Parameters<typeof mobileApi.createCategory>[1]
      );
      return;
    case "update_category":
      await mobileApi.updateCategory(
        accessToken,
        String(item.payload.categoryId || ""),
        (item.payload.data || {}) as Parameters<typeof mobileApi.updateCategory>[2]
      );
      return;
    case "delete_category":
      await mobileApi.deleteCategory(accessToken, String(item.payload.categoryId || ""));
      return;
  }
}

export async function flushOfflineQueue(accessToken: string) {
  const queue = await loadQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0, remaining: 0, lastError: null as string | null };
  }

  const remaining: OfflineQueueItem[] = [];
  let processed = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const item of queue) {
    try {
      await applyQueueItem(accessToken, item);
      processed += 1;
    } catch (error) {
      failed += 1;
      lastError = error instanceof Error ? error.message : "Unknown offline sync error";
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError,
      });
    }
  }

  await saveQueue(remaining);
  return { processed, failed, remaining: remaining.length, lastError };
}
