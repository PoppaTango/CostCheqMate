export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const merchant = searchParams.get("merchant");

    if (!merchant) {
      return NextResponse.json({ categoryId: null });
    }

    const mapping = await prisma.merchantCategory.findUnique({
      where: {
        userId_merchant: {
          userId: session.user.id,
          merchant: merchant.toLowerCase(),
        },
      },
    });

    return NextResponse.json({ categoryId: mapping?.categoryId || null });
  } catch (error) {
    console.error("Merchant suggest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
