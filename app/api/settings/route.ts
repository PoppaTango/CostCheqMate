export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
        fiscalYearStart: true,
        accountType: true,
        businessName: true,
        businessLogoUrl: true,
        needsWalkthrough: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, currency, fiscalYearStart, businessName, needsWalkthrough } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name || undefined;
    if (currency !== undefined) updateData.currency = currency || undefined;
    if (fiscalYearStart !== undefined) updateData.fiscalYearStart = parseInt(fiscalYearStart);
    if (businessName !== undefined) updateData.businessName = businessName || null;
    if (needsWalkthrough !== undefined) updateData.needsWalkthrough = Boolean(needsWalkthrough);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
        fiscalYearStart: true,
        accountType: true,
        businessName: true,
        businessLogoUrl: true,
        needsWalkthrough: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
