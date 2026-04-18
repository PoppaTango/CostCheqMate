import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { userId: session.user.id };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const additionalIncomes = await prisma.additionalIncome.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(additionalIncomes);
  } catch (error) {
    console.error("Get additional incomes error:", error);
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
    const { amount, source, description, date } = body;

    if (!amount || !source || !date) {
      return NextResponse.json(
        { error: "Amount, source, and date are required" },
        { status: 400 }
      );
    }

    const additionalIncome = await prisma.additionalIncome.create({
      data: {
        amount: parseFloat(amount),
        source,
        description: description || null,
        date: new Date(date),
        userId: session.user.id,
      },
    });

    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);
    await logMutation({
      entityType: "additional_income",
      entityId: additionalIncome.id,
      operation: "create",
      payload: {
        amount: additionalIncome.amount,
        source: additionalIncome.source,
        description: additionalIncome.description,
        date: additionalIncome.date.toISOString(),
      },
    });

    return NextResponse.json(additionalIncome, { status: 201 });
  } catch (error) {
    console.error("Create additional income error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
