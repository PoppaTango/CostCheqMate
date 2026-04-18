// =============================================================================
// REPORT DETAIL API - Review and update individual reports
// PUT: Update report status, priority, or add resolution
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// PUT - Update a report (change status, priority, add resolution)
// -----------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get report ID from params
    const { id } = await params;
    
    // Parse request body
    const body = await request.json();
    const { status, priority, resolution } = body;

    // Find the report
    const report = await prisma.userReport.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      // If resolving or dismissing, mark as reviewed
      if (['resolved', 'dismissed'].includes(status)) {
        updateData.reviewedById = session.user.id;
        updateData.reviewedAt = new Date();
      }
    }
    
    if (priority) {
      updateData.priority = priority;
    }
    
    if (resolution) {
      updateData.resolution = resolution;
    }

    // Update the report and log action
    const [updatedReport] = await prisma.$transaction([
      prisma.userReport.update({
        where: { id },
        data: updateData,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          reportedUser: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      // Log the action
      prisma.moderatorAction.create({
        data: {
          action: 'report_review',
          targetUserId: report.reportedUserId,
          performedById: session.user.id,
          details: JSON.stringify({ reportId: id, status, priority }),
          previousValue: report.status,
          newValue: status || report.status,
          reason: resolution || null,
        },
      }),
    ]);

    return NextResponse.json({ report: updatedReport });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
