// =============================================================================
// CHEQS UTILITY - Functions for awarding and managing Cheqs rewards
// This file provides utility functions for the Cheqs reward system
// =============================================================================

import { prisma } from '@/lib/db';

// -----------------------------------------------------------------------------
// PREMIUM SUBSCRIPTION CONSTANTS
// Premium is now monthly: $1.99/month OR 2000 Cheqs/month
// -----------------------------------------------------------------------------

/** Monthly premium price in dollars */
export const PREMIUM_MONTHLY_PRICE = 1.99;

/** Monthly business plan price in dollars (includes all premium + Excel/export features + custom branding) */
export const BUSINESS_MONTHLY_PRICE = 9.99;

/** Cost in Cheqs to unlock premium for one month */
export const PREMIUM_MONTHLY_CHEQS = 2000;

// -----------------------------------------------------------------------------
// REFERRAL REWARD CONSTANTS
// 1 referral = 500 Cheqs
// 3 referrals = 1 premium month
// 5 referrals = 3 premium months
// -----------------------------------------------------------------------------

export const REFERRAL_REWARDS = {
  CHEQS_PER_REFERRAL: 500,              // Each referral awards 500 Cheqs
  MILESTONE_3_REFERRALS: 1,             // 3 referrals = 1 premium month
  MILESTONE_5_REFERRALS: 3,             // 5 referrals = 3 premium months
};

// -----------------------------------------------------------------------------
// LEGACY CONSTANTS - Kept for backward compatibility with existing code
// -----------------------------------------------------------------------------

/** Legacy cheqs reward constants - used by bug reports and login streak */
export const CHEQ_REWARDS = {
  // Bug report rewards by severity
  BUG_REPORT_LOW: 10,
  BUG_REPORT_MEDIUM: 25,
  BUG_REPORT_HIGH: 50,
  BUG_REPORT_CRITICAL: 100,
  
  // Login streak rewards
  SEVEN_DAY_LOGIN_STREAK: 50,
  THIRTY_DAY_LOGIN_STREAK: 200,
  
  // Other rewards
  DAILY_LOGIN: 1,
  MANUAL_ENTRY: 1,
  SCAN_RECEIPT: 2,
  REFERRAL_BONUS: 500, // Updated to 500
};

/** @deprecated Use PREMIUM_MONTHLY_CHEQS instead */
export const PREMIUM_CHEQS_COST = PREMIUM_MONTHLY_CHEQS;

/**
 * Award type identifiers for different actions
 */
export type CheqsAwardType = 
  | 'manual_entry'    // Manual expense entry
  | 'scan'            // Scanning a receipt
  | 'login'           // Daily login bonus
  | 'streak'          // Login streak bonus
  | 'referral'        // Referring a new user
  | 'bug_report'      // Valid bug report
  | 'purchase';       // Purchased Cheqs

/**
 * Get the current Cheqs configuration from database
 * Creates default config if none exists
 */
export async function getCheqsConfig() {
  let config = await prisma.cheqsConfig.findUnique({
    where: { id: 'cheqs_config' },
  });

  // Create default config if none exists
  if (!config) {
    config = await prisma.cheqsConfig.create({
      data: {
        id: 'cheqs_config',
        cheqsPerManualEntry: 1,
        cheqsPerScan: 2,
        cheqsPerLogin: 1,
        cheqsPerStreakDay: 2,
        cheqsPerReferral: 100,
        cheqsPerBugReport: 25,
        premiumMultiplier: 1.5,
        maxDailyCheqs: 50,
      },
    });
  }

  return config;
}

/**
 * Calculate Cheqs to award for a specific action
 * Applies premium multiplier if user is premium
 * @param type - The type of action
 * @param isPremium - Whether the user is premium
 * @param config - Cheqs configuration (optional, will fetch if not provided)
 * @returns Number of Cheqs to award
 */
export async function calculateCheqsReward(
  type: CheqsAwardType,
  isPremium: boolean = false,
  config?: Awaited<ReturnType<typeof getCheqsConfig>>
): Promise<number> {
  const cheqsConfig = config || await getCheqsConfig();

  // Base Cheqs by action type
  let baseCheqs = 0;
  switch (type) {
    case 'manual_entry':
      baseCheqs = cheqsConfig.cheqsPerManualEntry;
      break;
    case 'scan':
      baseCheqs = cheqsConfig.cheqsPerScan;
      break;
    case 'login':
      baseCheqs = cheqsConfig.cheqsPerLogin;
      break;
    case 'streak':
      baseCheqs = cheqsConfig.cheqsPerStreakDay;
      break;
    case 'referral':
      baseCheqs = cheqsConfig.cheqsPerReferral;
      break;
    case 'bug_report':
      baseCheqs = cheqsConfig.cheqsPerBugReport;
      break;
    case 'purchase':
      // Purchases handled separately
      return 0;
  }

  // Apply premium multiplier for premium users
  if (isPremium && type !== 'referral') {
    baseCheqs = Math.floor(baseCheqs * cheqsConfig.premiumMultiplier);
  }

  return baseCheqs;
}

/**
 * Award Cheqs to a user for a specific action
 * Logs the award in activity log
 * @param userId - User ID to award
 * @param type - Type of action being rewarded
 * @param metadata - Optional additional data about the award
 * @returns Number of Cheqs awarded, or 0 if failed
 */
export async function awardCheqs(
  userId: string,
  type: CheqsAwardType,
  metadata?: Record<string, unknown>
): Promise<number> {
  try {
    // Get user to check premium status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true, cheqs: true },
    });

    if (!user) return 0;

    const isPremium = user.accountType === 'premium';
    const cheqsToAward = await calculateCheqsReward(type, isPremium);

    if (cheqsToAward <= 0) return 0;

    // Update user's Cheqs balance
    await prisma.user.update({
      where: { id: userId },
      data: {
        cheqs: { increment: cheqsToAward },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'cheqs_earned',
        details: JSON.stringify({
          type,
          amount: cheqsToAward,
          isPremium,
          ...metadata,
        }),
      },
    });

    return cheqsToAward;
  } catch (error) {
    console.error('Error awarding Cheqs:', error);
    return 0;
  }
}

/**
 * Get descriptive text for Cheqs award types
 */
export const CHEQS_AWARD_LABELS: Record<CheqsAwardType, string> = {
  manual_entry: 'Manual Expense Entry',
  scan: 'Receipt Scan',
  login: 'Daily Login',
  streak: 'Login Streak Bonus',
  referral: 'User Referral',
  bug_report: 'Bug Report Reward',
  purchase: 'Purchased Cheqs',
};

// -----------------------------------------------------------------------------
// PREMIUM SUBSCRIPTION UTILITIES
// -----------------------------------------------------------------------------

/**
 * Add premium time to a user's subscription
 * @param userId - The user to add premium time to
 * @param months - Number of months to add
 * @returns Updated premium expiration date
 */
export async function addPremiumTime(userId: string, months: number): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumExpiresAt: true, accountType: true, role: true },
  });

  if (!user) throw new Error('User not found');

  // Calculate new expiration date
  const now = new Date();
  let newExpiration: Date;

  if (user.premiumExpiresAt && user.premiumExpiresAt > now) {
    // User already has active premium - extend it
    newExpiration = new Date(user.premiumExpiresAt);
  } else {
    // Start fresh from now
    newExpiration = new Date();
  }

  // Add months
  newExpiration.setMonth(newExpiration.getMonth() + months);

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      premiumExpiresAt: newExpiration,
      accountType: 'premium',
      // Update role to premium if currently free
      role: user.role === 'free' ? 'premium' : user.role,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'premium_added',
      details: JSON.stringify({ months, newExpiration }),
    },
  });

  return newExpiration;
}

/**
 * Check if user's premium has expired and downgrade if needed
 * @param userId - The user to check
 * @returns True if premium is still active, false if expired
 */
export async function checkPremiumStatus(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumExpiresAt: true, accountType: true, role: true },
  });

  if (!user) return false;

  // Admin/superuser/moderator roles keep premium features
  if (['admin', 'superuser', 'moderator'].includes(user.role)) {
    return true;
  }

  // If accountType is premium/business but no expiry date, treat as permanent (manual promotion)
  if (['premium', 'business'].includes(user.accountType) && !user.premiumExpiresAt) {
    return true;
  }

  // Check if premium/business has expired
  if (user.premiumExpiresAt && user.premiumExpiresAt <= new Date()) {
    // Premium/business has expired - downgrade
    const wasType = user.accountType;
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountType: 'free',
        role: 'free',
        premiumExpiresAt: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: wasType === 'business' ? 'business_expired' : 'premium_expired',
        details: JSON.stringify({ expiredAt: user.premiumExpiresAt, previousType: wasType }),
      },
    });

    return false;
  }

  return ['premium', 'business'].includes(user.accountType);
}

/**
 * Add business plan time to a user (includes all premium features + business features)
 * @param userId - The user to upgrade
 * @param months - Number of months to add
 * @returns The new expiration date
 */
export async function addBusinessTime(userId: string, months: number): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumExpiresAt: true, accountType: true, role: true },
  });

  if (!user) throw new Error('User not found');

  const now = new Date();
  let newExpiration: Date;

  if (user.premiumExpiresAt && user.premiumExpiresAt > now) {
    newExpiration = new Date(user.premiumExpiresAt);
  } else {
    newExpiration = new Date();
  }

  newExpiration.setMonth(newExpiration.getMonth() + months);

  await prisma.user.update({
    where: { id: userId },
    data: {
      premiumExpiresAt: newExpiration,
      accountType: 'business',
      role: user.role === 'free' ? 'premium' : user.role,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'business_added',
      details: JSON.stringify({ months, newExpiration }),
    },
  });

  return newExpiration;
}

/**
 * Redeem Cheqs for premium subscription
 * @param userId - The user redeeming
 * @param months - Number of months (1 month = 2000 Cheqs)
 * @returns Result with success status and new expiration
 */
export async function redeemCheqsForPremium(
  userId: string, 
  months: number = 1
): Promise<{ success: boolean; message: string; newExpiration?: Date; cheqsDeducted?: number }> {
  const cheqsRequired = PREMIUM_MONTHLY_CHEQS * months;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cheqs: true },
  });

  if (!user) return { success: false, message: 'User not found' };

  if (user.cheqs < cheqsRequired) {
    return { 
      success: false, 
      message: `Not enough Cheqs. Need ${cheqsRequired}, have ${user.cheqs}` 
    };
  }

  // Deduct Cheqs
  await prisma.user.update({
    where: { id: userId },
    data: { cheqs: { decrement: cheqsRequired } },
  });

  // Add premium time
  const newExpiration = await addPremiumTime(userId, months);

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'cheqs_redeemed_premium',
      details: JSON.stringify({ months, cheqsDeducted: cheqsRequired, newExpiration }),
    },
  });

  return {
    success: true,
    message: `Successfully redeemed ${cheqsRequired} Cheqs for ${months} month(s) of premium!`,
    newExpiration,
    cheqsDeducted: cheqsRequired,
  };
}

// -----------------------------------------------------------------------------
// REFERRAL UTILITIES
// -----------------------------------------------------------------------------

/**
 * Generate a unique referral code for a user
 * @param userId - The user to generate code for
 * @returns The generated referral code
 */
export async function generateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, name: true },
  });

  if (!user) throw new Error('User not found');
  if (user.referralCode) return user.referralCode;

  // Generate unique code based on user name and random string
  const namePart = (user.name || 'user').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const code = `${namePart}${randomPart}`;

  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code },
  });

  return code;
}

/**
 * Process a completed referral and award bonuses
 * @param referrerId - The user who made the referral
 * @param referredUserId - The new user who signed up
 * @returns Result with awards given
 */
export async function processReferral(
  referrerId: string,
  referredUserId: string
): Promise<{ cheqsAwarded: number; premiumMonthsAwarded: number; totalReferrals: number }> {
  // Update referrer's total referrals
  const referrer = await prisma.user.update({
    where: { id: referrerId },
    data: {
      totalReferrals: { increment: 1 },
      cheqs: { increment: REFERRAL_REWARDS.CHEQS_PER_REFERRAL },
    },
    select: { totalReferrals: true },
  });

  let premiumMonthsAwarded = 0;

  // Check for milestone bonuses
  if (referrer.totalReferrals === 3) {
    // 3 referrals = 1 premium month
    premiumMonthsAwarded = REFERRAL_REWARDS.MILESTONE_3_REFERRALS;
    await addPremiumTime(referrerId, premiumMonthsAwarded);
  } else if (referrer.totalReferrals === 5) {
    // 5 referrals = 3 premium months
    premiumMonthsAwarded = REFERRAL_REWARDS.MILESTONE_5_REFERRALS;
    await addPremiumTime(referrerId, premiumMonthsAwarded);
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: referrerId,
      action: 'referral_completed',
      details: JSON.stringify({
        referredUserId,
        cheqsAwarded: REFERRAL_REWARDS.CHEQS_PER_REFERRAL,
        premiumMonthsAwarded,
        totalReferrals: referrer.totalReferrals,
      }),
    },
  });

  return {
    cheqsAwarded: REFERRAL_REWARDS.CHEQS_PER_REFERRAL,
    premiumMonthsAwarded,
    totalReferrals: referrer.totalReferrals,
  };
}

/**
 * Get referral stats for a user
 */
export async function getReferralStats(userId: string): Promise<{
  referralCode: string;
  totalReferrals: number;
  cheqsEarned: number;
  premiumMonthsEarned: number;
  nextMilestone: { referrals: number; reward: string } | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, totalReferrals: true },
  });

  if (!user) throw new Error('User not found');

  // Generate code if doesn't exist
  const referralCode = user.referralCode || await generateReferralCode(userId);

  // Calculate earnings
  const cheqsEarned = user.totalReferrals * REFERRAL_REWARDS.CHEQS_PER_REFERRAL;
  let premiumMonthsEarned = 0;
  if (user.totalReferrals >= 5) {
    premiumMonthsEarned = REFERRAL_REWARDS.MILESTONE_3_REFERRALS + REFERRAL_REWARDS.MILESTONE_5_REFERRALS;
  } else if (user.totalReferrals >= 3) {
    premiumMonthsEarned = REFERRAL_REWARDS.MILESTONE_3_REFERRALS;
  }

  // Calculate next milestone
  let nextMilestone: { referrals: number; reward: string } | null = null;
  if (user.totalReferrals < 3) {
    nextMilestone = { referrals: 3 - user.totalReferrals, reward: '1 month premium' };
  } else if (user.totalReferrals < 5) {
    nextMilestone = { referrals: 5 - user.totalReferrals, reward: '3 months premium' };
  }

  return {
    referralCode,
    totalReferrals: user.totalReferrals,
    cheqsEarned,
    premiumMonthsEarned,
    nextMilestone,
  };
}
