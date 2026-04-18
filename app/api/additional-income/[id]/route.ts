import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { amount, source, description, date } = body;
    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);

    // Verify ownership
    const existing = await prisma.additionalIncome.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.additionalIncome.update({
      where: { id },
      data: {
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        source: source || undefined,
        description: description !== undefined ? description : undefined,
        date: date ? new Date(date) : undefined,
      },
    });

    await logMutation({
      entityType: "additional_income",
      entityId: updated.id,
      operation: "update",
      payload: {
        amount: updated.amount,
        source: updated.source,
        date: updated.date.toISOString(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update additional income error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);

    // Verify ownership
    const existing = await prisma.additionalIncome.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.additionalIncome.delete({ where: { id } });

    await logMutation({
      entityType: "additional_income",
      entityId: id,
      operation: "delete",
      payload: { deletedAt: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete additional income error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
