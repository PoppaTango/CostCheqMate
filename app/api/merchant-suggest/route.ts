export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const merchant = searchParams.get("merchant");

    if (!merchant) {
      return NextResponse.json({ categoryId: null });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: session.user.id,
      actionType: "smart_category_suggestion",
      consume: true,
      metadata: { merchant },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Smart category suggestion requires Premium. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    const mapping = await prisma.merchantCategory.findUnique({
      where: {
        userId_merchant: {
          userId: session.user.id,
          merchant: merchant.toLowerCase(),
        },
      },
    });

    return NextResponse.json({ categoryId: mapping?.categoryId || null });
  } catch (error) {
    console.error("Merchant suggest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
