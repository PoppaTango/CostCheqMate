export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";
import { awardCheqs } from "@/lib/cheqs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = { userId: auth.userId };
    if (categoryId) where.categoryId = categoryId;
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Mobile expenses GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const amount = Number(body?.amount);
    const categoryId = String(body?.categoryId || "");
    const merchant = body?.merchant ? String(body.merchant) : null;
    const description = body?.description ? String(body.description) : null;
    const date = body?.date ? new Date(body.date) : null;
    const receiptUrl = body?.receiptUrl ? String(body.receiptUrl) : null;
    const receiptKey = body?.receiptKey ? String(body.receiptKey) : null;

    if (!amount || Number.isNaN(amount) || !categoryId || !date) {
      return NextResponse.json(
        { error: "amount, categoryId, and date are required" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: auth.userId },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        amount,
        categoryId,
        userId: auth.userId,
        merchant,
        description,
        date,
        receiptUrl,
        receiptKey,
      },
      include: { category: true },
    });

    if (merchant) {
      await prisma.merchantCategory.upsert({
        where: {
          userId_merchant: {
            userId: auth.userId,
            merchant: merchant.toLowerCase(),
          },
        },
        update: { categoryId },
        create: {
          userId: auth.userId,
          merchant: merchant.toLowerCase(),
          categoryId,
        },
      });
    }

    const logMutation = createMutationLoggerFromHeaders(request.headers, auth.userId, "mobile");
    await logMutation({
      entityType: "expense",
      entityId: expense.id,
      operation: "create",
      payload: {
        amount: expense.amount,
        merchant: expense.merchant,
        description: expense.description,
        date: expense.date.toISOString(),
        categoryId: expense.categoryId,
      },
    });

    const hasReceipt = Boolean(receiptUrl || receiptKey);
    const cheqsAwarded = await awardCheqs(auth.userId, hasReceipt ? "scan" : "manual_entry", {
      expenseId: expense.id,
      amount: expense.amount,
      merchant: expense.merchant,
      category: expense.category?.name,
    });

    return NextResponse.json({ expense, cheqsAwarded }, { status: 201 });
  } catch (error) {
    console.error("Mobile expenses POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
