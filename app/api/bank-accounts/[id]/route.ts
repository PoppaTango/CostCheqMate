import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

// PUT update a bank account
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logMutation = createMutationLoggerFromHeaders(request.headers, session.user.id);
    const { id } = await params;
    const body = await request.json();
    const { bankName, accountName, accountNumber, accountType } = body;

    // Verify ownership
    const existingAccount = await prisma.bankAccount.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    const updatedAccount = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...(bankName && { bankName }),
        ...(accountName && { accountName }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(accountType && { accountType }),
      },
    });

    await logMutation({
      entityType: "bank_account",
      entityId: updatedAccount.id,
      operation: "update",
      payload: {
        id: updatedAccount.id,
        bankName: updatedAccount.bankName,
        accountName: updatedAccount.accountName,
        accountNumber: updatedAccount.accountNumber,
        accountType: updatedAccount.accountType,
        updatedAt: updatedAccount.updatedAt.toISOString(),
      },
    });

    return NextResponse.json(updatedAccount);
  } catch (error: unknown) {
    console.error("Error updating bank account:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update bank account" },
      { status: 500 }
    );
  }
}

// DELETE a bank account
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logMutation = createMutationLoggerFromHeaders(request.headers, session.user.id);
    const { id } = await params;

    // Verify ownership
    const existingAccount = await prisma.bankAccount.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    // Delete the bank account (categories will have bankAccountId set to null due to onDelete: SetNull)
    await prisma.bankAccount.delete({
      where: { id },
    });

    await logMutation({
      entityType: "bank_account",
      entityId: id,
      operation: "delete",
      payload: { id, deletedAt: new Date().toISOString() },
    });

    return NextResponse.json({ message: "Bank account deleted successfully" });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    return NextResponse.json(
      { error: "Failed to delete bank account" },
      { status: 500 }
    );
  }
}
