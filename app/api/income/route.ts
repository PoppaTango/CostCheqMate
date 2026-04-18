export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let income = await prisma.incomeSetting.findUnique({
      where: { userId: session.user.id },
    });

    if (!income) {
      income = await prisma.incomeSetting.create({
        data: {
          userId: session.user.id,
          netAmountPerPay: 0,
          frequency: "bi-weekly",
        },
      });
    }

    return NextResponse.json(income);
  } catch (error) {
    console.error("Get income error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { netAmountPerPay, frequency, firstPayDate } = body;

    const income = await prisma.incomeSetting.upsert({
      where: { userId: session.user.id },
      update: {
        netAmountPerPay: netAmountPerPay !== undefined ? parseFloat(netAmountPerPay) : undefined,
        frequency: frequency || undefined,
        firstPayDate: firstPayDate ? new Date(firstPayDate) : undefined,
      },
      create: {
        userId: session.user.id,
        netAmountPerPay: parseFloat(netAmountPerPay) || 0,
        frequency: frequency || "bi-weekly",
        firstPayDate: firstPayDate ? new Date(firstPayDate) : null,
      },
    });

    return NextResponse.json(income);
  } catch (error) {
    console.error("Update income error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
