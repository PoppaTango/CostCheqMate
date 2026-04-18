// =============================================================================
// PAYMENT HISTORY API - Get user's payment history
// GET: Returns paginated list of user's payments
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// GET - Fetch payment history
// Regular users see their own payments
// Moderators can see all payments (with userId filter)
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    const where: Record<string, unknown> = {};

    // Regular users can only see their own payments
    if (!currentUser || !canModerate(currentUser.role)) {
      where.userId = session.user.id;
    } else if (userId) {
      // Moderators can filter by userId
      where.userId = userId;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch payments with pagination
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    // Calculate totals for moderators
    let totals = null;
    if (currentUser && canModerate(currentUser.role)) {
      const aggregates = await prisma.payment.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
        _count: true,
      });
      totals = {
        totalRevenue: aggregates._sum.amount || 0,
        totalTransactions: aggregates._count,
      };
    }

    return NextResponse.json({
      payments,
      totals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
