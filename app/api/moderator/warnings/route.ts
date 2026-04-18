// =============================================================================
// WARNINGS API - Manage user warnings
// GET: Fetch warnings (all or by user)
// POST: Issue a new warning to a user
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate, canManageUser } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// GET - Fetch warnings (optionally filtered by userId)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has moderator permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !canModerate(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause based on filters
    const where = userId ? { userId } : {};

    // Fetch warnings with pagination
    const [warnings, total] = await Promise.all([
      prisma.userWarning.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          issuedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userWarning.count({ where }),
    ]);

    return NextResponse.json({
      warnings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching warnings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST - Issue a new warning to a user
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has moderator permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!currentUser || !canModerate(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { userId, type, reason, severity, expiresAt } = body;

    // Validate required fields
    if (!userId || !type || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check target user exists and can be warned
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check role hierarchy - can't warn users at same or higher level
    if (!canManageUser(currentUser.role, targetUser.role)) {
      return NextResponse.json(
        { error: "Cannot warn users with equal or higher privileges" },
        { status: 403 }
      );
    }

    // Create the warning and log the action in a transaction
    const [warning] = await prisma.$transaction([
      prisma.userWarning.create({
        data: {
          userId,
          issuedById: session.user.id,
          type,
          reason,
          severity: severity || 1,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          issuedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      // Log the moderation action
      prisma.moderatorAction.create({
        data: {
          action: 'warning_issue',
          targetUserId: userId,
          performedById: session.user.id,
          details: JSON.stringify({ type, severity }),
          reason,
        },
      }),
    ]);

    return NextResponse.json({ warning });
  } catch (error) {
    console.error("Error creating warning:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
