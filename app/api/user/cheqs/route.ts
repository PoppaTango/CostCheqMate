// =============================================================================
// USER CHEQS API - Manage user Cheqs and premium subscription
// GET: Get user's Cheqs balance and premium status
// POST: Redeem Cheqs for premium or add Cheqs
// Premium is now monthly: $1.99/month OR 2000 Cheqs/month
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { 
  PREMIUM_MONTHLY_CHEQS, 
  PREMIUM_MONTHLY_PRICE,
  BUSINESS_MONTHLY_PRICE,
  REFERRAL_REWARDS,
  redeemCheqsForPremium,
  checkPremiumStatus,
  getReferralStats,
} from "@/lib/cheqs";
import { getPremiumTrialStatusForUser } from "@/lib/premium-trial";

// -----------------------------------------------------------------------------
// GET - Get user's Cheqs balance and premium status
// Returns: { cheqs, accountType, role, status, premiumExpiresAt, referralStats, pricing }
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check and update premium status (may expire premium if needed)
    await checkPremiumStatus(session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        cheqs: true,
        accountType: true,
        isAdmin: true,
        role: true,
        status: true,
        premiumExpiresAt: true,
        referralCode: true,
        totalReferrals: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get referral stats
    let referralStats = null;
    try {
      referralStats = await getReferralStats(session.user.id);
    } catch {
      // If referral stats fail, continue without them
    }

    let premiumTrial = null;
    try {
      premiumTrial = await getPremiumTrialStatusForUser(session.user.id);
    } catch {
      premiumTrial = null;
    }

    return NextResponse.json({
      cheqs: user.cheqs,
      accountType: user.accountType,
      isAdmin: user.isAdmin,
      role: user.role,
      status: user.status,
      premiumExpiresAt: user.premiumExpiresAt,
      referralCode: user.referralCode,
      totalReferrals: user.totalReferrals,
      referralStats,
      premiumTrial,
      // Pricing info
      pricing: {
        premiumMonthlyCheqs: PREMIUM_MONTHLY_CHEQS,
        premiumMonthlyPrice: PREMIUM_MONTHLY_PRICE,
        businessMonthlyPrice: BUSINESS_MONTHLY_PRICE,
        cheqsPerReferral: REFERRAL_REWARDS.CHEQS_PER_REFERRAL,
        referralMilestones: {
          3: REFERRAL_REWARDS.MILESTONE_3_REFERRALS, // 1 month
          5: REFERRAL_REWARDS.MILESTONE_5_REFERRALS, // 3 months
        },
      },
      // Deprecated - for backward compatibility
      premiumCost: PREMIUM_MONTHLY_CHEQS,
    });
  } catch (error) {
    console.error("Error fetching cheqs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST - Redeem Cheqs for premium or manage Cheqs
// Body: { action, months, amount }
// Actions: "unlock_premium", "add"
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, months = 1, amount } = await req.json();

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cheqs: true, accountType: true, premiumExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "add") {
      // Add cheqs (for admin use or testing)
      const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: { cheqs: { increment: amount || 0 } },
        select: { cheqs: true, accountType: true, premiumExpiresAt: true },
      });
      return NextResponse.json(updated);
    }

    if (action === "unlock_premium") {
      // Redeem Cheqs for premium subscription
      const monthsToRedeem = Math.max(1, Math.min(12, parseInt(months) || 1));
      const result = await redeemCheqsForPremium(session.user.id, monthsToRedeem);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }

      // Get updated user data
      const updatedUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { cheqs: true, accountType: true, premiumExpiresAt: true },
      });

      return NextResponse.json({
        ...updatedUser,
        message: result.message,
        cheqsDeducted: result.cheqsDeducted,
        newExpiration: result.newExpiration,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating cheqs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
