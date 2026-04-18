import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileAccessToken } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileAccessToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { userId: auth.id },
    include: { bankAccount: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateMobileAccessToken(request.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const icon = body?.icon ? String(body.icon) : "📦";
    const color = body?.color ? String(body.color) : "#6366f1";
    const annualBudget = Number(body?.annualBudget || 0);
    const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        icon,
        color,
        annualBudget: Number.isFinite(annualBudget) ? annualBudget : 0,
        bankAccountId,
        userId: auth.id,
      },
      include: { bankAccount: true },
    });

    const logMutation = createMutationLoggerFromHeaders(request.headers, auth.id, "mobile");
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
        bankAccountId: category.bankAccountId,
        updatedAt: category.updatedAt.toISOString(),
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }
    console.error("Mobile categories create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
