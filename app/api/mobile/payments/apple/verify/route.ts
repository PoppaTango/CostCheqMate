import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";
import { addBusinessTime, addPremiumTime } from "@/lib/cheqs";

type AppleVerifyRequest = {
  receiptData?: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  platform?: string;
};

type AppleVerifyResponse = {
  status: number;
  receipt?: {
    in_app?: Array<Record<string, string>>;
  };
};

const APPLE_PRODUCTION_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_VERIFY_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

function resolvePlanFromProductId(productId: string) {
  const normalized = productId.toLowerCase();
  if (normalized.includes("business")) {
    return {
      accountType: "business",
      months: 1 as const,
      amount: 9.99,
      paymentType: "ios_business",
    };
  }
  return {
    accountType: "premium",
    months: 1 as const,
    amount: 1.99,
    paymentType: "ios_premium",
  };
}

async function verifyWithApple(receiptData: string, useSandbox: boolean) {
  const payload: Record<string, string | boolean> = {
    "receipt-data": receiptData,
    "exclude-old-transactions": true,
  };

  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
  if (sharedSecret) {
    payload.password = sharedSecret;
  }

  const response = await fetch(
    useSandbox ? APPLE_SANDBOX_VERIFY_URL : APPLE_PRODUCTION_VERIFY_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Apple receipt verify failed with HTTP ${response.status}`);
  }

  return (await response.json()) as AppleVerifyResponse;
}

function findMatchingTransaction(
  inAppItems: Array<Record<string, string>> | undefined,
  productId: string,
  transactionId: string,
  originalTransactionId?: string
) {
  if (!Array.isArray(inAppItems)) return null;
  return (
    inAppItems.find((item) => {
      const productMatches = item.product_id === productId;
      const transactionMatches = item.transaction_id === transactionId;
      const originalMatches = originalTransactionId
        ? item.original_transaction_id === originalTransactionId
        : true;
      return productMatches && transactionMatches && originalMatches;
    }) || null
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = (await request.json()) as AppleVerifyRequest;
    const platform = String(body.platform || "ios").toLowerCase();
    const receiptData = String(body.receiptData || "");
    const productId = String(body.productId || "");
    const transactionId = String(body.transactionId || "");
    const originalTransactionId = body.originalTransactionId
      ? String(body.originalTransactionId)
      : undefined;

    if (platform !== "ios") {
      return NextResponse.json(
        { error: "This endpoint only accepts iOS purchase verification payloads" },
        { status: 400 }
      );
    }

    if (!receiptData || !productId || !transactionId) {
      return NextResponse.json(
        { error: "receiptData, productId, and transactionId are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.payment.findFirst({
      where: {
        userId: auth.userId,
        type: { in: ["ios_premium", "ios_business"] },
        stripePaymentId: transactionId,
        status: "completed",
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        status: "already_verified",
        message: "Apple purchase already verified.",
        paymentId: existing.id,
        transactionId,
        productId,
      });
    }

    let appleResponse = await verifyWithApple(receiptData, false);
    if (appleResponse.status === 21007) {
      appleResponse = await verifyWithApple(receiptData, true);
    }

    if (appleResponse.status !== 0) {
      return NextResponse.json(
        {
          status: "verification_failed",
          message: `Apple receipt verification failed (status ${appleResponse.status})`,
        },
        { status: 400 }
      );
    }

    const matched = findMatchingTransaction(
      appleResponse.receipt?.in_app,
      productId,
      transactionId,
      originalTransactionId
    );
    if (!matched) {
      return NextResponse.json(
        {
          status: "verification_failed",
          message: "Verified receipt does not contain the requested transaction.",
        },
        { status: 400 }
      );
    }

    const plan = resolvePlanFromProductId(productId);
    const payment = await prisma.payment.create({
      data: {
        userId: auth.userId,
        amount: plan.amount,
        currency: "USD",
        type: plan.paymentType,
        status: "pending",
        stripePaymentId: transactionId,
        note: `Apple IAP ${plan.accountType} plan`,
        metadata: JSON.stringify({
          platform: "ios",
          productId,
          transactionId,
          originalTransactionId: matched.original_transaction_id || originalTransactionId || null,
          source: "mobile_iap",
        }),
      },
    });

    const expiresAt =
      plan.accountType === "business"
        ? await addBusinessTime(auth.userId, plan.months)
        : await addPremiumTime(auth.userId, plan.months);

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "completed", completedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.userId,
        action: "ios_iap_verified",
        details: JSON.stringify({
          paymentId: payment.id,
          productId,
          transactionId,
          accountType: plan.accountType,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      status: "verified",
      message: "Apple IAP verified successfully.",
      paymentId: payment.id,
      transactionId,
      productId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Apple IAP verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
