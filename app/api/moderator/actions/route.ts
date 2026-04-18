export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canModerate } from "@/lib/moderator";

// GET /api/moderator/actions - Get moderator action log
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const actionType = searchParams.get('action') || '';
    const performedById = searchParams.get('performedById') || '';
    const targetUserId = searchParams.get('targetUserId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    
    if (actionType) {
      where.action = actionType;
    }
    if (performedById) {
      where.performedById = performedById;
    }
    if (targetUserId) {
      where.targetUserId = targetUserId;
    }

    const [actions, total] = await Promise.all([
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

    return NextResponse.json({
      actions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
