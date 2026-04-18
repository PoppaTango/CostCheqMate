// =============================================================================
// GRANT AUDIT ACCESS API - Allow Admin to grant audit trail access to SuperUsers
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/moderator";

/**
 * POST /api/admin/grant-audit-access
 * Grant or revoke audit trail access for a SuperUser
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Admin can grant audit access
    const performer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!performer || !isAdmin(performer.role)) {
      return NextResponse.json({ error: "Only administrators can grant audit trail access" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, grant } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, name: true, canViewAuditTrail: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Can only grant to SuperUsers
    if (targetUser.role !== 'superuser') {
      return NextResponse.json({ 
        error: "Audit trail access can only be granted to Super Users" 
      }, { status: 400 });
    }

    // Update access
    await prisma.user.update({
      where: { id: userId },
      data: { canViewAuditTrail: grant === true },
    });

    // Log the action
    await prisma.moderatorAction.create({
      data: {
        action: 'audit_access_change',
        targetUserId: userId,
        performedById: session.user.id,
        previousValue: String(targetUser.canViewAuditTrail),
        newValue: String(grant === true),
        reason: grant ? 'Granted audit trail access' : 'Revoked audit trail access',
        details: JSON.stringify({
          targetEmail: targetUser.email,
          targetName: targetUser.name,
        }),
      },
    });

    return NextResponse.json({ 
      success: true,
      canViewAuditTrail: grant === true,
    });
  } catch (error) {
    console.error("Grant audit access error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
