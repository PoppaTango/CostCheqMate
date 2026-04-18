import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

/**
 * Phase 2 placeholder for Apple IAP verification.
 * The next phase should replace this with full App Store Server API validation
 * and signed transaction parsing.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const platform = String(body?.platform || "").toLowerCase();
    const transactionId = String(body?.transactionId || "");
    const productId = String(body?.productId || "");
    const payload = body?.payload;

    if (platform !== "ios") {
      return NextResponse.json(
        { error: "This endpoint only accepts iOS purchase verification payloads" },
        { status: 400 }
      );
    }

    if (!transactionId || !productId) {
      return NextResponse.json(
        { error: "transactionId and productId are required" },
        { status: 400 }
      );
    }

    // Store a pending audit row so IAP implementation can be completed without losing data.
    const pendingPayment = await prisma.payment.create({
      data: {
        userId: auth.userId,
        amount: 0,
        currency: "USD",
        type: "ios_iap_pending",
        status: "pending",
        note: `Pending Apple IAP verification for ${productId}`,
        metadata: JSON.stringify({
          transactionId,
          productId,
          payload: payload || null,
        }),
      },
    });

    return NextResponse.json({
      status: "pending_verification",
      message:
        "Apple IAP verification hook received. Full App Store validation integration is pending.",
      paymentId: pendingPayment.id,
    });
  } catch (error) {
    console.error("Apple IAP verify placeholder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
