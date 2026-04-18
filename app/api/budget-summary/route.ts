export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fiscalYearStart: true },
    });

    const fiscalYearStart = user?.fiscalYearStart ?? 1;

    // Calculate fiscal year dates if not provided
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      if (currentMonth >= fiscalYearStart) {
        start = new Date(currentYear, fiscalYearStart - 1, 1);
        end = new Date(currentYear + 1, fiscalYearStart - 1, 0);
      } else {
        start = new Date(currentYear - 1, fiscalYearStart - 1, 1);
        end = new Date(currentYear, fiscalYearStart - 1, 0);
      }
    }

    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
    });

    const expenses = await prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        userId: session.user.id,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const expenseMap = new Map(expenses.map((e) => [e.categoryId, e._sum.amount ?? 0]));

    // Calculate YTD proration factor: fraction of fiscal year elapsed
    const now = new Date();
    const fiscalStartMs = start.getTime();
    const fiscalEndMs = end.getTime();
    const nowMs = Math.min(now.getTime(), fiscalEndMs); // cap at fiscal year end
    const elapsedFraction = Math.max(0, Math.min(1, (nowMs - fiscalStartMs) / (fiscalEndMs - fiscalStartMs)));

    const summary = categories.map((cat) => {
      const spent = expenseMap.get(cat.id) ?? 0;
      const ytdBudget = cat.annualBudget * elapsedFraction;
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        annualBudget: cat.annualBudget,
        ytdBudget: Math.round(ytdBudget * 100) / 100,
        spent,
        remaining: cat.annualBudget - spent,
        ytdRemaining: Math.round((ytdBudget - spent) * 100) / 100,
        cloudFolderId: cat.cloudFolderId,
        cloudFolderName: cat.cloudFolderName,
      };
    });

    const totalBudget = categories.reduce((sum, c) => sum + c.annualBudget, 0);
    const totalYtdBudget = Math.round(totalBudget * elapsedFraction * 100) / 100;
    const totalSpent = expenses.reduce((sum, e) => sum + (e._sum.amount ?? 0), 0);

    return NextResponse.json({
      categories: summary,
      totalBudget,
      totalYtdBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      totalYtdRemaining: Math.round((totalYtdBudget - totalSpent) * 100) / 100,
      elapsedFraction: Math.round(elapsedFraction * 10000) / 10000,
      fiscalYearStart: start.toISOString(),
      fiscalYearEnd: end.toISOString(),
    });
  } catch (error) {
    console.error("Budget summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
