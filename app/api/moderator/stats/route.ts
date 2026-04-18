export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate } from "@/lib/moderator";

// GET /api/moderator/stats - Get moderation statistics
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !canModerate(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [totalUsers, activeUsers, bannedUsers, suspendedUsers, activeBans, moderators, totalActions, recentActions] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'banned' } }),
      prisma.user.count({ where: { status: 'suspended' } }),
      prisma.userBan.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { in: ['moderator', 'admin'] } } }),
      prisma.moderatorAction.count(),
      prisma.moderatorAction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    // Get action breakdown for last 7 days
    const actionBreakdown = await prisma.moderatorAction.groupBy({
      by: ['action'],
      _count: { action: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Get user breakdown by role
    const roleBreakdown = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });

    // Get account type breakdown
    const accountTypeBreakdown = await prisma.user.groupBy({
      by: ['accountType'],
      _count: { accountType: true },
    });

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        suspended: suspendedUsers,
        moderators,
      },
      bans: {
        active: activeBans,
      },
      actions: {
        total: totalActions,
        recent: recentActions,
        breakdown: actionBreakdown,
      },
      breakdown: {
        roles: roleBreakdown,
        accountTypes: accountTypeBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
