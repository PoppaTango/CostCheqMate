import { prisma } from "@/lib/db";

export const PREMIUM_TRIAL_MONTHLY_ACTION_LIMIT = 10;

const PREMIUM_TRIAL_ACTION_PREFIX = "premium_trial_action:";
const FULL_ACCESS_ACCOUNT_TYPES = new Set(["premium", "business"]);
const FULL_ACCESS_ROLES = new Set(["moderator", "superuser", "admin"]);

export type PremiumTrialActionType =
  | "smart_category_suggestion"
  | "export_api_access"
  | "cloud_storage_action";

type UserAccessSnapshot = {
  accountType: string;
  role: string;
};

export type PremiumTrialStatus = {
  limit: number;
  usedActions: number;
  remainingActions: number;
  hasFullPremiumAccess: boolean;
  isFreeTrialEligible: boolean;
  currentPeriodStart: string;
  nextResetAt: string;
};

export type PremiumFeatureAccessDecision = {
  allowed: boolean;
  consumed: boolean;
  status: PremiumTrialStatus;
};

function getCurrentPeriodBounds(now = new Date()) {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const nextResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { periodStart, nextResetAt };
}

function hasFullPremiumAccess(user: UserAccessSnapshot) {
  return (
    FULL_ACCESS_ACCOUNT_TYPES.has(user.accountType) ||
    FULL_ACCESS_ROLES.has(user.role)
  );
}

async function getMonthlyTrialUsageCount(
  userId: string,
  periodStart: Date,
  nextResetAt: Date
) {
  return prisma.activityLog.count({
    where: {
      userId,
      action: { startsWith: PREMIUM_TRIAL_ACTION_PREFIX },
      createdAt: {
        gte: periodStart,
        lt: nextResetAt,
      },
    },
  });
}

export async function getPremiumTrialStatusForUser(
  userId: string,
  now = new Date()
): Promise<PremiumTrialStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { periodStart, nextResetAt } = getCurrentPeriodBounds(now);
  const fullAccess = hasFullPremiumAccess(user);
  const isFreeTrialEligible = user.accountType === "free" && !fullAccess;
  const usedActions = isFreeTrialEligible
    ? await getMonthlyTrialUsageCount(userId, periodStart, nextResetAt)
    : 0;
  const remainingActions = isFreeTrialEligible
    ? Math.max(PREMIUM_TRIAL_MONTHLY_ACTION_LIMIT - usedActions, 0)
    : PREMIUM_TRIAL_MONTHLY_ACTION_LIMIT;

  return {
    limit: PREMIUM_TRIAL_MONTHLY_ACTION_LIMIT,
    usedActions,
    remainingActions,
    hasFullPremiumAccess: fullAccess,
    isFreeTrialEligible,
    currentPeriodStart: periodStart.toISOString(),
    nextResetAt: nextResetAt.toISOString(),
  };
}

export async function consumePremiumTrialAction(input: {
  userId: string;
  actionType: PremiumTrialActionType;
  metadata?: Record<string, unknown>;
}) {
  const status = await getPremiumTrialStatusForUser(input.userId);
  if (status.hasFullPremiumAccess) {
    return {
      allowed: true as const,
      consumed: false as const,
      status,
    };
  }

  if (!status.isFreeTrialEligible || status.remainingActions <= 0) {
    return {
      allowed: false as const,
      consumed: false as const,
      status,
    };
  }

  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: `${PREMIUM_TRIAL_ACTION_PREFIX}${input.actionType}`,
      details: JSON.stringify({
        actionType: input.actionType,
        source: "premium_trial",
        ...(input.metadata || {}),
      }),
    },
  });

  return {
    allowed: true as const,
    consumed: true as const,
    status: {
      ...status,
      usedActions: status.usedActions + 1,
      remainingActions: Math.max(status.remainingActions - 1, 0),
    },
  };
}

export async function evaluatePremiumFeatureAccess(input: {
  userId: string;
  actionType: PremiumTrialActionType;
  consume: boolean;
  metadata?: Record<string, unknown>;
}): Promise<PremiumFeatureAccessDecision> {
  if (input.consume) {
    return consumePremiumTrialAction({
      userId: input.userId,
      actionType: input.actionType,
      metadata: input.metadata,
    });
  }

  const status = await getPremiumTrialStatusForUser(input.userId);
  const allowed = status.hasFullPremiumAccess || (status.isFreeTrialEligible && status.remainingActions > 0);
  return {
    allowed,
    consumed: false,
    status,
  };
}
