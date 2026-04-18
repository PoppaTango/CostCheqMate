// =============================================================================
// AUDIT TRAIL API - View comprehensive audit logs of all system changes
// Accessible by Admin and SuperUsers with canViewAuditTrail permission
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/moderator";

/**
 * GET /api/admin/audit-trail
 * Fetch audit trail with filtering options
 * Query params:
 * - type: Filter by action type (role_change, status_change, cheqs_edit, etc.)
 * - userId: Filter by target user
 * - performerId: Filter by who performed the action
 * - startDate: Start date for date range filter
 * - endDate: End date for date range filter
 * - page: Page number for pagination
 * - limit: Items per page (default 50)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, canViewAuditTrail: true },
    });

    // Check access: Admin OR SuperUser with canViewAuditTrail
    const hasAccess = user && (
      isAdmin(user.role) || 
      (user.role === 'superuser' && user.canViewAuditTrail)
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "You don't have permission to view audit trails" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');
    const performerId = searchParams.get('performerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Build filter conditions
    const where: any = {};

    if (type) {
      where.action = type;
    }

    if (userId) {
      where.targetUserId = userId;
    }

    if (performerId) {
      where.performedById = performerId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Fetch moderator actions (primary audit log)
    const [actions, totalCount] = await Promise.all([
      prisma.moderatorAction.findMany({
        where,
        include: {
          targetUser: {
            select: { id: true, name: true, email: true },
          },
          performedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.moderatorAction.count({ where }),
    ]);

    // Get unique action types for filter dropdown
    const actionTypes = await prisma.moderatorAction.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });

    return NextResponse.json({
      actions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      actionTypes: actionTypes.map(a => ({
        type: a.action,
        count: a._count.action,
      })),
    });
  } catch (error) {
    console.error("Get audit trail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/audit-trail/export
 * Export audit trail data to CSV format
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, canViewAuditTrail: true },
    });

    const hasAccess = user && (
      isAdmin(user.role) || 
      (user.role === 'superuser' && user.canViewAuditTrail)
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { startDate, endDate, types } = body;

    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (types && types.length > 0) {
      where.action = { in: types };
    }

    const actions = await prisma.moderatorAction.findMany({
      where,
      include: {
        targetUser: { select: { name: true, email: true } },
        performedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Max 10k records for export
    });

    // Generate CSV
    const headers = ['Date', 'Action', 'Target User', 'Target Email', 'Performed By', 'Performer Email', 'Previous Value', 'New Value', 'Reason'];
    const rows = actions.map(action => [
      new Date(action.createdAt).toISOString(),
      action.action,
      action.targetUser?.name || 'N/A',
      action.targetUser?.email || 'N/A',
      action.performedBy?.name || 'N/A',
      action.performedBy?.email || 'N/A',
      action.previousValue || '',
      action.newValue || '',
      action.reason || '',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-trail-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export audit trail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
