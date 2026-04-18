// =============================================================================
// NOTES API - Internal staff notes about users
// GET: Fetch notes (all or by user)
// POST: Create a new note about a user
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate, isAdmin } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// GET - Fetch notes (optionally filtered by userId)
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause - hide private notes from non-admins
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    
    // Non-admins can't see private notes
    if (!isAdmin(currentUser.role)) {
      where.isPrivate = false;
    }

    // Fetch notes with pagination
    const [notes, total] = await Promise.all([
      prisma.userNote.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: [
          { isPinned: 'desc' },  // Pinned notes first
          { createdAt: 'desc' }, // Then by date
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userNote.count({ where }),
    ]);

    return NextResponse.json({
      notes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST - Create a new note about a user
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
    const { userId, content, category, isPinned, isPrivate } = body;

    // Validate required fields
    if (!userId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins can create private notes
    const noteIsPrivate = isPrivate && isAdmin(currentUser.role);

    // Create the note
    const note = await prisma.userNote.create({
      data: {
        userId,
        authorId: session.user.id,
        content,
        category: category || 'general',
        isPinned: isPinned || false,
        isPrivate: noteIsPrivate,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        author: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
