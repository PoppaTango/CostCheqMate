export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      include: { bankAccount: true },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);
    const { name, icon, color, annualBudget, bankAccountId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        icon: icon || "📦",
        color: color || "#6366f1",
        annualBudget: annualBudget || 0,
        bankAccountId: bankAccountId || null,
        userId: session.user.id,
      },
      include: { bankAccount: true },
    });

    await logMutation({
      entityType: "category",
      entityId: category.id,
      operation: "create",
      payload: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        annualBudget: category.annualBudget,
        userId: category.userId,
        isDefault: category.isDefault,
        bankAccountId: category.bankAccountId,
        cloudFolderId: category.cloudFolderId,
        cloudFolderName: category.cloudFolderName,
        updatedAt: category.updatedAt.toISOString(),
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("Create category error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
