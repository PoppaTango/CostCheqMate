export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate } from "@/lib/moderator";

// DELETE /api/moderator/bans/[id] - Revoke a ban
export async function DELETE(
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
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const ban = await prisma.userBan.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, status: true } },
      },
    });

    if (!ban) {
      return NextResponse.json({ error: "Ban not found" }, { status: 404 });
    }

    if (!ban.isActive) {
      return NextResponse.json({ error: "Ban is already revoked" }, { status: 400 });
    }

    // Check if there are other active bans for this user
    const otherActiveBans = await prisma.userBan.count({
      where: {
        userId: ban.userId,
        isActive: true,
        id: { not: id },
      },
    });

    // Revoke ban and optionally update user status
    await prisma.$transaction([
      prisma.userBan.update({
        where: { id },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: reason || null,
        },
      }),
      // Only set status to active if no other active bans
      ...(otherActiveBans === 0
        ? [
            prisma.user.update({
              where: { id: ban.userId },
              data: { status: 'active' },
            }),
          ]
        : []),
      prisma.moderatorAction.create({
        data: {
          action: 'ban_revoke',
          targetUserId: ban.userId,
          performedById: session.user.id,
          details: JSON.stringify({ banId: id, originalReason: ban.reason }),
          previousValue: 'banned',
          newValue: otherActiveBans === 0 ? 'active' : 'banned',
          reason: reason || 'Ban revoked',
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking ban:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
