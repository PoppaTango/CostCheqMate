// =============================================================================
// REFERRALS API - Manage user referral codes and stats
// GET: Get user's referral code and stats
// POST: Generate new referral code if doesn't exist
// =============================================================================

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReferralStats, generateReferralCode, REFERRAL_REWARDS, PREMIUM_MONTHLY_CHEQS } from "@/lib/cheqs";
import { prisma } from "@/lib/db";

// -----------------------------------------------------------------------------
// GET - Get user's referral code and stats
// Returns: { referralCode, totalReferrals, cheqsEarned, premiumMonthsEarned, nextMilestone, referralLink }
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getReferralStats(session.user.id);
    
    // Get recent referrals
    const recentReferrals = await prisma.referral.findMany({
      where: { referrerId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        referredEmail: true,
        status: true,
        cheqsAwarded: true,
        premiumAwarded: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...stats,
      recentReferrals,
      rewards: {
        cheqsPerReferral: REFERRAL_REWARDS.CHEQS_PER_REFERRAL,
        milestone3: { referrals: 3, premiumMonths: REFERRAL_REWARDS.MILESTONE_3_REFERRALS },
        milestone5: { referrals: 5, premiumMonths: REFERRAL_REWARDS.MILESTONE_5_REFERRALS },
      },
      premiumMonthlyCheqs: PREMIUM_MONTHLY_CHEQS,
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral stats" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST - Generate or regenerate referral code
// Returns: { referralCode }
// -----------------------------------------------------------------------------
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const referralCode = await generateReferralCode(session.user.id);

    return NextResponse.json({ referralCode });
  } catch (error) {
    console.error("Error generating referral code:", error);
    return NextResponse.json(
      { error: "Failed to generate referral code" },
      { status: 500 }
    );
  }
}
