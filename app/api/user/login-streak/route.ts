import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CHEQ_REWARDS } from "@/lib/cheqs";

// GET - Get user's login streak info
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const streak = await prisma.loginStreak.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      currentStreak: streak?.currentStreak || 0,
      lastLoginDate: streak?.lastLoginDate || null,
      totalRewards: streak?.totalRewards || 0,
    });
  } catch (error) {
    console.error("Get login streak error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Record a login and update streak
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Get or create login streak record
    let streak = await prisma.loginStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      streak = await prisma.loginStreak.create({
        data: { userId, currentStreak: 0 },
      });
    }

    const lastLogin = streak.lastLoginDate ? new Date(streak.lastLoginDate) : null;
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
    }

    let newStreak = streak.currentStreak;
    let cheqsEarned = 0;
    let streakBonusEarned = false;

    // Check if this is a new day
    const timeDiff = lastLogin ? today.getTime() - lastLogin.getTime() : Infinity;
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Already logged in today, no change
      return NextResponse.json({
        currentStreak: newStreak,
        cheqsEarned: 0,
        streakBonusEarned: false,
        message: "Already logged in today",
      });
    } else if (daysDiff === 1) {
      // Consecutive day - increment streak
      newStreak += 1;
    } else {
      // Streak broken - reset to 1
      newStreak = 1;
    }

    // Check if user hit 7-day streak
    if (newStreak >= 7 && newStreak % 7 === 0) {
      cheqsEarned = CHEQ_REWARDS.SEVEN_DAY_LOGIN_STREAK;
      streakBonusEarned = true;
    }

    // Update streak record
    await prisma.loginStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        lastLoginDate: today,
        totalRewards: { increment: cheqsEarned },
      },
    });

    // Award cheqs if earned
    if (cheqsEarned > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { cheqs: { increment: cheqsEarned } },
      });
    }

    return NextResponse.json({
      currentStreak: newStreak,
      cheqsEarned,
      streakBonusEarned,
      message: streakBonusEarned
        ? `🎉 7-day streak bonus! You earned ${cheqsEarned} Cheqs!`
        : `Streak: ${newStreak} days`,
    });
  } catch (error) {
    console.error("Update login streak error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
