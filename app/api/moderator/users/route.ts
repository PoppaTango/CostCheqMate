// =============================================================================
// MODERATOR USERS API - Fetch, filter, and update users for moderation
// GET: Fetch users with search, role, and status filters
// PUT: Update user role, status, cheqs, custom labels, etc.
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate, canChangeRole, canManageUser, canDeleteUser, isAdminEmail, isSuperAdminEmail, ROLE_HIERARCHY, UserRole } from "@/lib/moderator";
import { sendNotificationEmail, generateRoleUpgradeEmail } from "@/lib/notifications";
import { getPremiumTrialStatusesForUsers } from "@/lib/premium-trial";

// -----------------------------------------------------------------------------
// GET - Fetch users with filtering and pagination
// Query params: search, role, status, page, limit
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
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause based on filters
    const where: Record<string, unknown> = {};
    
    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Filter by role (skip if "all")
    if (role && role !== 'all') {
      where.role = role;
    }
    
    // Filter by status (skip if "all")
    if (status && status !== 'all') {
      where.status = status;
    }

    // Fetch users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customRoleLabel: true,
          status: true,
          accountType: true,
          cheqs: true,
          isVerified: true,
          canViewAuditTrail: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          bans: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              reason: true,
              offense: true,
              endDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Fetch role labels for reference
    const roleLabels = await prisma.roleLabel.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const premiumTrialStatuses = await getPremiumTrialStatusesForUsers(
      users.map((user: { id: string; accountType: string; role: string }) => ({
        id: user.id,
        accountType: user.accountType,
        role: user.role,
      }))
    );

    const usersWithPremiumTrial = users.map((user: { id: string }) => ({
      ...user,
      premiumTrial: premiumTrialStatuses[user.id] || null,
    }));

    return NextResponse.json({
      users: usersWithPremiumTrial,
      roleLabels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT - Update user role, status, cheqs, custom label, or audit access
// Sends email notification when upgrading a user's role
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's role and email
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true, name: true },
    });

    if (!currentUser || !canModerate(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, status, cheqs, customRoleLabel, canViewAuditTrail, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true, cheqs: true, customRoleLabel: true, canViewAuditTrail: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if performer can manage this user (pass performer email for super admin check)
    if (!canManageUser(currentUser.role, targetUser.role, targetUser.email || undefined, currentUser.email || undefined)) {
      return NextResponse.json({ error: "You cannot manage this user" }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const logActions: Array<{ action: string; previousValue: string; newValue: string }> = [];

    // Handle role change
    if (role !== undefined && role !== targetUser.role) {
      // Validate role change permission (pass performer email for super admin check)
      if (!canChangeRole(currentUser.role, targetUser.role, role, targetUser.email || undefined, currentUser.email || undefined)) {
        return NextResponse.json({ error: "You cannot assign this role" }, { status: 403 });
      }

      // Check if this is an upgrade (new role is higher)
      const oldLevel = ROLE_HIERARCHY[targetUser.role as UserRole] ?? 0;
      const newLevel = ROLE_HIERARCHY[role as UserRole] ?? 0;
      const isUpgrade = newLevel > oldLevel;

      updateData.role = role;
      
      // Also update accountType for premium role
      if (role === 'premium' || role === 'moderator' || role === 'superuser' || role === 'admin') {
        updateData.accountType = 'premium';
      }

      logActions.push({
        action: 'role_change',
        previousValue: targetUser.role,
        newValue: role,
      });

      // Send upgrade email notification if it's an upgrade
      if (isUpgrade && targetUser.email && process.env.NOTIF_ID_ROLE_UPGRADE_NOTIFICATION) {
        try {
          const { subject, html } = generateRoleUpgradeEmail(
            targetUser.name || 'User',
            role as UserRole,
            currentUser.name || undefined
          );
          
          await sendNotificationEmail(
            process.env.NOTIF_ID_ROLE_UPGRADE_NOTIFICATION,
            targetUser.email,
            subject,
            html
          );
        } catch (emailError) {
          console.error('Failed to send role upgrade email:', emailError);
          // Don't fail the update if email fails
        }
      }
    }

    // Handle status change
    if (status !== undefined && status !== targetUser.status) {
      updateData.status = status;
      logActions.push({
        action: 'status_change',
        previousValue: targetUser.status,
        newValue: status,
      });
    }

    // Handle cheqs change (admin/superuser only)
    if (cheqs !== undefined && cheqs !== targetUser.cheqs) {
      if (!['admin', 'superuser'].includes(currentUser.role)) {
        return NextResponse.json({ error: "Only admins can modify Cheqs" }, { status: 403 });
      }
      updateData.cheqs = parseInt(cheqs);
      logActions.push({
        action: 'cheqs_edit',
        previousValue: String(targetUser.cheqs),
        newValue: String(cheqs),
      });
    }

    // Handle custom role label (admin only)
    if (customRoleLabel !== undefined && customRoleLabel !== targetUser.customRoleLabel) {
      if (currentUser.role !== 'admin') {
        return NextResponse.json({ error: "Only administrators can set custom labels" }, { status: 403 });
      }
      updateData.customRoleLabel = customRoleLabel || null;
      logActions.push({
        action: 'custom_label_change',
        previousValue: targetUser.customRoleLabel || 'none',
        newValue: customRoleLabel || 'none',
      });
    }

    // Handle audit trail access (admin only, superusers only)
    if (canViewAuditTrail !== undefined && canViewAuditTrail !== targetUser.canViewAuditTrail) {
      if (currentUser.role !== 'admin') {
        return NextResponse.json({ error: "Only administrators can grant audit access" }, { status: 403 });
      }
      if (targetUser.role !== 'superuser') {
        return NextResponse.json({ error: "Audit access can only be granted to Super Users" }, { status: 400 });
      }
      updateData.canViewAuditTrail = canViewAuditTrail;
      logActions.push({
        action: 'audit_access_change',
        previousValue: String(targetUser.canViewAuditTrail),
        newValue: String(canViewAuditTrail),
      });
    }

    // Apply updates if any
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No changes to apply" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customRoleLabel: true,
        status: true,
        accountType: true,
        cheqs: true,
        canViewAuditTrail: true,
      },
    });

    // Log all actions
    for (const log of logActions) {
      await prisma.moderatorAction.create({
        data: {
          action: log.action,
          targetUserId: userId,
          performedById: session.user.id,
          previousValue: log.previousValue,
          newValue: log.newValue,
          reason: reason || null,
          details: JSON.stringify({
            targetEmail: targetUser.email,
            targetName: targetUser.name,
            performerEmail: currentUser.email,
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      changes: logActions.length,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE - Delete a user (Admin only)
// Cascading delete removes all related data (expenses, categories, etc.)
// -----------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's role and email
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true, name: true },
    });

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: "Only administrators can delete users" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if deletion is allowed
    if (!canDeleteUser(currentUser.role, targetUser.role, targetUser.email || undefined, currentUser.email || undefined)) {
      return NextResponse.json({ error: "You cannot delete this user" }, { status: 403 });
    }

    // Log the deletion before actually deleting
    await prisma.moderatorAction.create({
      data: {
        action: 'user_delete',
        targetUserId: userId,
        performedById: session.user.id,
        previousValue: JSON.stringify({
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        }),
        newValue: 'deleted',
        reason: reason || 'No reason provided',
        details: JSON.stringify({
          targetEmail: targetUser.email,
          targetName: targetUser.name,
          performerEmail: currentUser.email,
          performerName: currentUser.name,
          deletedAt: new Date().toISOString(),
        }),
      },
    });

    // Delete the user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.email} has been deleted`,
      deletedUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
