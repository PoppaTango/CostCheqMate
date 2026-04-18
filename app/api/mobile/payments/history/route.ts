import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const page = Math.max(
      1,
      parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1
    );
    const limit = Math.max(
      1,
      Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "20", 10) || 20, 100)
    );

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where: { userId: auth.userId } }),
    ]);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Mobile payments history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
