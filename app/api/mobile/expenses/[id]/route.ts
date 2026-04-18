import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";
import { deleteFile } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.expense.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const body = await request.json();
    const amount =
      body?.amount !== undefined ? Number(body.amount) : existing.amount;
    const categoryId =
      body?.categoryId !== undefined
        ? String(body.categoryId || "")
        : existing.categoryId;
    const date =
      body?.date !== undefined ? new Date(String(body.date)) : existing.date;

    if (!Number.isFinite(amount) || amount <= 0 || !categoryId || Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Valid amount, categoryId, and date are required" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: auth.userId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        amount,
        merchant:
          body?.merchant !== undefined ? (body.merchant ? String(body.merchant) : null) : existing.merchant,
        description:
          body?.description !== undefined
            ? (body.description ? String(body.description) : null)
            : existing.description,
        date,
        categoryId,
        receiptUrl:
          body?.receiptUrl !== undefined
            ? (body.receiptUrl ? String(body.receiptUrl) : null)
            : existing.receiptUrl,
        receiptKey:
          body?.receiptKey !== undefined
            ? (body.receiptKey ? String(body.receiptKey) : null)
            : existing.receiptKey,
      },
      include: { category: true },
    });

    const logMutation = createMutationLoggerFromHeaders(request.headers, auth.userId, "mobile");
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

    return NextResponse.json({ expense: updated });
  } catch (error) {
    console.error("Mobile expense update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.expense.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (existing.receiptKey) {
      try {
        await deleteFile(existing.receiptKey);
      } catch (fileError) {
        console.error("Failed to delete receipt file for mobile delete:", fileError);
      }
    }

    await prisma.expense.delete({ where: { id } });

    const logMutation = createMutationLoggerFromHeaders(request.headers, auth.userId, "mobile");
    await logMutation({
      entityType: "expense",
      entityId: id,
      operation: "delete",
      payload: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile expense delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
