// =============================================================================
// ANNOUNCEMENTS API - System-wide announcements from staff
// GET: Fetch announcements (with role filtering for regular users)
// POST: Create a new announcement (admin+ only)
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, canModerate } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// GET - Fetch announcements
// Regular users see only announcements targeted at their role
// Staff see all announcements
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's role
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (activeOnly) {
      where.isActive = true;
      // Also filter out expired announcements
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    // Non-staff users only see announcements targeted at their role
    if (!canModerate(currentUser.role)) {
      where.targetRoles = { has: currentUser.role };
    }

    // Fetch announcements
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    return NextResponse.json({
      announcements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST - Create a new announcement (admin+ only)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !isAdmin(currentUser.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { title, content, type, targetRoles, isPinned, expiresAt } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    // Create the announcement
    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        type: type || 'info',
        targetRoles: targetRoles || ['user', 'moderator', 'admin', 'owner'],
        isPinned: isPinned || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
