export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/s3";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expense = await prisma.expense.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Delete receipt from S3 if exists
    if (expense.receiptKey) {
      try {
        await deleteFile(expense.receiptKey);
      } catch (e) {
        console.error("Failed to delete receipt file:", e);
      }
    }

    await prisma.expense.delete({ where: { id: params.id } });
    await logMutation({
      entityType: "expense",
      entityId: params.id,
      operation: "delete",
      payload: null,
    });

    return NextResponse.json({ message: "Expense deleted" });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, merchant, description, date, categoryId } = body;
    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);

    const expense = await prisma.expense.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        amount: amount !== undefined ? parseFloat(amount) : expense.amount,
        merchant: merchant ?? expense.merchant,
        description: description ?? expense.description,
        date: date ? new Date(date) : expense.date,
        categoryId: categoryId ?? expense.categoryId,
      },
      include: { category: true },
    });
    await logMutation({
      entityType: "expense",
      entityId: updated.id,
      operation: "update",
      payload: {
        id: updated.id,
        amount: updated.amount,
        merchant: updated.merchant,
        description: updated.description,
        date: updated.date.toISOString(),
        categoryId: updated.categoryId,
        receiptUrl: updated.receiptUrl,
        receiptKey: updated.receiptKey,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update expense error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
