export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate, canManageUser, calculateBanEndDate } from "@/lib/moderator";

// GET /api/moderator/bans - Get all active bans
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = activeOnly ? { isActive: true } : {};

    const [bans, total] = await Promise.all([
      prisma.userBan.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          issuedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userBan.count({ where }),
    ]);

    return NextResponse.json({
      bans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/moderator/bans - Issue a new ban
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!currentUser || !canModerate(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, reason, offense, evidence, duration } = body;

    if (!userId || !reason || !offense || !duration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check target user exists and can be banned
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!canManageUser(currentUser.role, targetUser.role)) {
      return NextResponse.json({ error: "Cannot ban users with equal or higher privileges" }, { status: 403 });
    }

    const endDate = calculateBanEndDate(duration);

    // Create ban and update user status
    const [ban] = await prisma.$transaction([
      prisma.userBan.create({
        data: {
          userId,
          reason,
          offense,
          evidence: evidence || null,
          endDate,
          issuedById: session.user.id,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          issuedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { status: 'banned' },
      }),
      prisma.moderatorAction.create({
        data: {
          action: 'ban_issue',
          targetUserId: userId,
          performedById: session.user.id,
          details: JSON.stringify({ reason, offense, duration, evidence }),
          previousValue: targetUser.status,
          newValue: 'banned',
          reason,
        },
      }),
    ]);

    return NextResponse.json({ ban });
  } catch (error) {
    console.error("Error creating ban:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
