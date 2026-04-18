import { prisma } from "@/lib/db";

type MutationSource = "mobile" | "web";

interface MutationInput {
  userId: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  payload?: Record<string, unknown> | null;
  source?: MutationSource;
  clientMutationId?: string;
  occurredAt?: Date;
}

export async function logMobileMutation(input: MutationInput) {
  const payload =
    input.payload === undefined || input.payload === null
      ? null
      : JSON.stringify(input.payload);

  if (input.clientMutationId) {
    const existing = await prisma.mobileMutationLog.findFirst({
      where: {
        userId: input.userId,
        clientMutationId: input.clientMutationId,
      },
    });

    if (existing) {
      return existing;
    }
  }

  try {
    return await prisma.mobileMutationLog.create({
      data: {
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        operation: input.operation,
        payload,
        source: input.source ?? "web",
        clientMutationId: input.clientMutationId ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002" &&
      input.clientMutationId
    ) {
      return prisma.mobileMutationLog.findFirst({
        where: {
          userId: input.userId,
          clientMutationId: input.clientMutationId,
        },
      });
    }
    throw error;
  }
}

export function parseSinceParam(since?: string | null): Date {
  if (!since) {
    return new Date(0);
  }

  const parsed = new Date(since);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }
  return parsed;
}

export function createMutationLoggerFromHeaders(
  headers: Headers,
  userId: string,
  source: MutationSource = "web"
) {
  const clientMutationId = headers.get("x-client-mutation-id")?.trim() || undefined;

  return async (input: Omit<MutationInput, "userId" | "source" | "clientMutationId">) => {
    return logMobileMutation({
      ...input,
      userId,
      source,
      clientMutationId,
    });
  };
}

export function createMutationLogger(
  userId: string,
  headers: Headers,
  source: MutationSource = "web"
) {
  const logMutation = createMutationLoggerFromHeaders(headers, userId, source);
  return async (
    entityType: string,
    entityId: string,
    operation: "create" | "update" | "delete",
    payload?: Record<string, unknown> | null
  ) => {
    return logMutation({ entityType, entityId, operation, payload });
  };
}

export function parseClientMutationId(req: Request) {
  return req.headers.get("x-client-mutation-id")?.trim() || undefined;
}

export async function recordMutation(input: MutationInput) {
  return logMobileMutation(input);
}

export async function recordMobileMutation(input: MutationInput) {
  return logMobileMutation(input);
}

export async function createMutationLog(input: MutationInput) {
  return logMobileMutation(input);
}

export async function getExpenseChangesSince(userId: string, since: Date, limit = 200) {
  return prisma.expense.findMany({
    where: {
      userId,
      updatedAt: { gt: since },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
}

export async function getCategoryChangesSince(userId: string, since: Date, limit = 200) {
  return prisma.category.findMany({
    where: {
      userId,
      updatedAt: { gt: since },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
}

export async function getBankAccountChangesSince(userId: string, since: Date, limit = 200) {
  return prisma.bankAccount.findMany({
    where: {
      userId,
      updatedAt: { gt: since },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
}

export async function getAdditionalIncomeChangesSince(userId: string, since: Date, limit = 200) {
  return prisma.additionalIncome.findMany({
    where: {
      userId,
      updatedAt: { gt: since },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
}

export async function getMutationLogSince(userId: string, since: Date, limit = 500) {
  return prisma.mobileMutationLog.findMany({
    where: {
      userId,
      occurredAt: { gt: since },
    },
    orderBy: { occurredAt: "asc" },
    take: limit,
  });
}
