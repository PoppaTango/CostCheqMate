import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  getBankAccountChangesSince,
  getCategoryChangesSince,
  getExpenseChangesSince,
  getAdditionalIncomeChangesSince,
  getMutationLogSince,
  parseSinceParam,
} from "@/lib/mobile-sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const sinceParam = request.nextUrl.searchParams.get("since");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const since = parseSinceParam(sinceParam);
    const limit = Math.max(1, Math.min(parseInt(limitParam || "100", 10) || 100, 500));

    const [expenses, categories, bankAccounts, additionalIncome, mutations] =
      await Promise.all([
        getExpenseChangesSince(auth.userId, since, limit),
        getCategoryChangesSince(auth.userId, since, limit),
        getBankAccountChangesSince(auth.userId, since, limit),
        getAdditionalIncomeChangesSince(auth.userId, since, limit),
        getMutationLogSince(auth.userId, since, limit * 2),
      ]);

    const timestamps = [
      ...expenses.map((expense: { updatedAt: Date }) => expense.updatedAt.getTime()),
      ...categories.map((category: { updatedAt: Date }) => category.updatedAt.getTime()),
      ...bankAccounts.map((account: { updatedAt: Date }) => account.updatedAt.getTime()),
      ...additionalIncome.map((income: { updatedAt: Date }) => income.updatedAt.getTime()),
      ...mutations.map((mutation: { occurredAt: Date }) => mutation.occurredAt.getTime()),
    ];
    const serverTime = new Date();
    const nextCursor =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps, serverTime.getTime())).toISOString()
        : serverTime.toISOString();

    return NextResponse.json({
      since: since.toISOString(),
      nextCursor,
      serverTime: serverTime.toISOString(),
      changes: {
        expenses,
        categories,
        bankAccounts,
        additionalIncome,
      },
      mutations,
    });
  } catch (error) {
    console.error("Mobile sync changes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
