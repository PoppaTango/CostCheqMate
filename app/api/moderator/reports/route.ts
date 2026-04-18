// =============================================================================
// REPORTS API - User reports submitted by community members
// GET: Fetch reports with filtering
// POST: Submit a new user report (available to all logged-in users)
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// GET - Fetch reports (moderators only)
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
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;

    // Fetch reports with pagination
    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          reportedUser: { select: { id: true, name: true, email: true, role: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [
          { priority: 'desc' },   // Urgent first
          { createdAt: 'desc' },  // Then newest
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userReport.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST - Submit a new user report (any logged-in user can submit)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { reportedUserId, reason, description, evidence } = body;

    // Validate required fields
    if (!reportedUserId || !reason || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Can't report yourself
    if (reportedUserId === session.user.id) {
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
    }

    // Check reported user exists
    const reportedUser = await prisma.user.findUnique({
      where: { id: reportedUserId },
    });

    if (!reportedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create the report
    const report = await prisma.userReport.create({
      data: {
        reporterId: session.user.id,
        reportedUserId,
        reason,
        description,
        evidence: evidence || null,
        status: 'pending',
        priority: 'normal',
      },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reportedUser: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
