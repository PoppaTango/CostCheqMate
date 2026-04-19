export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate, canManageUser, canChangeRole } from "@/lib/moderator";
import { getPremiumTrialStatusForUser } from "@/lib/premium-trial";

// GET /api/moderator/users/[id] - Get single user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        accountType: true,
        cheqs: true,
        createdAt: true,
        updatedAt: true,
        bans: {
          orderBy: { createdAt: 'desc' },
          include: {
            issuedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        actionsReceived: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            performedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const premiumTrial = await getPremiumTrialStatusForUser(user.id);

    return NextResponse.json({ user: { ...user, premiumTrial } });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/moderator/users/[id] - Update user (role, status, cheqs, accountType)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, name: true },
    });

    if (!currentUser || !canModerate(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, value, reason } = body;

    // Prevent self-modification for role/status
    if (id === session.user.id && ['role', 'status'].includes(action)) {
      return NextResponse.json({ error: "Cannot modify your own role or status" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true, cheqs: true, accountType: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if can manage this user
    if (!canManageUser(currentUser.role, targetUser.role)) {
      return NextResponse.json({ error: "Cannot manage users with equal or higher privileges" }, { status: 403 });
    }

    let updateData: Record<string, unknown> = {};
    let previousValue = '';
    let newValue = '';
    let actionType = '';

    switch (action) {
      case 'role':
        if (!canChangeRole(currentUser.role, targetUser.role, value)) {
          return NextResponse.json({ error: "Cannot assign this role" }, { status: 403 });
        }
        updateData.role = value;
        previousValue = targetUser.role;
        newValue = value;
        actionType = 'role_change';
        break;

      case 'status':
        updateData.status = value;
        previousValue = targetUser.status;
        newValue = value;
        actionType = 'status_change';
        break;

      case 'cheqs':
        const cheqsValue = parseInt(value);
        if (isNaN(cheqsValue) || cheqsValue < 0) {
          return NextResponse.json({ error: "Invalid Cheqs value" }, { status: 400 });
        }
        updateData.cheqs = cheqsValue;
        previousValue = targetUser.cheqs.toString();
        newValue = cheqsValue.toString();
        actionType = 'cheqs_edit';
        break;

      case 'accountType':
        if (!['free', 'premium', 'business'].includes(value)) {
          return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
        }
        updateData.accountType = value;
        previousValue = targetUser.accountType;
        newValue = value;
        actionType = 'account_type_change';
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Update user and log action
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          accountType: true,
          cheqs: true,
        },
      }),
      prisma.moderatorAction.create({
        data: {
          action: actionType,
          targetUserId: id,
          performedById: session.user.id,
          details: JSON.stringify({ action, value }),
          previousValue,
          newValue,
          reason: reason || null,
        },
      }),
    ]);

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
