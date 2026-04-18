import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

// GET all bank accounts for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { userId: session.user.id },
      orderBy: [{ bankName: "asc" }, { accountName: "asc" }],
    });

    return NextResponse.json(bankAccounts);
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank accounts" },
      { status: 500 }
    );
  }
}

// POST create a new bank account
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bankName, accountName, accountNumber, accountType } = body;

    if (!bankName || !accountName) {
      return NextResponse.json(
        { error: "Bank name and account name are required" },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        bankName,
        accountName,
        accountNumber: accountNumber || null,
        accountType: accountType || "checking",
        userId: session.user.id,
      },
    });

    const logMutation = createMutationLoggerFromHeaders(request.headers, session.user.id);
    await logMutation({
      entityType: "bank_account",
      entityId: bankAccount.id,
      operation: "create",
      payload: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        accountName: bankAccount.accountName,
        accountNumber: bankAccount.accountNumber,
        accountType: bankAccount.accountType,
        updatedAt: bankAccount.updatedAt.toISOString(),
      },
    });

    return NextResponse.json(bankAccount, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating bank account:", error);
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
      { error: "Failed to create bank account" },
      { status: 500 }
    );
  }
}
