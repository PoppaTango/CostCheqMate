export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { awardCheqs } from "@/lib/cheqs";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { userId: session.user.id };

    if (categoryId) {
      where.categoryId = categoryId;
    }

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

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Get expenses error:", error);
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
    const { amount, merchant, description, date, categoryId, receiptUrl, receiptKey } = body;

    if (!amount || !categoryId || !date) {
      return NextResponse.json(
        { error: "Amount, category, and date are required" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: session.user.id },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        merchant: merchant || null,
        description: description || null,
        date: new Date(date),
        categoryId,
        userId: session.user.id,
        receiptUrl: receiptUrl || null,
        receiptKey: receiptKey || null,
      },
      include: { category: true },
    });

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
        receiptUrl: expense.receiptUrl,
        receiptKey: expense.receiptKey,
      },
    });

    // Store merchant-category mapping for auto-suggest
    if (merchant) {
      await prisma.merchantCategory.upsert({
        where: {
          userId_merchant: {
            userId: session.user.id,
            merchant: merchant.toLowerCase(),
          },
        },
        update: { categoryId },
        create: {
          merchant: merchant.toLowerCase(),
          categoryId,
          userId: session.user.id,
        },
      });
    }

    // Award Cheqs for expense entry
    // If there's a receipt, it's a scan; otherwise it's manual entry
    const hasReceipt = receiptUrl || receiptKey;
    const awardType = hasReceipt ? 'scan' : 'manual_entry';
    const cheqsAwarded = await awardCheqs(session.user.id, awardType, {
      expenseId: expense.id,
      amount: expense.amount,
      merchant: expense.merchant,
      category: expense.category?.name,
    });

    return NextResponse.json({ ...expense, cheqsAwarded }, { status: 201 });
  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
