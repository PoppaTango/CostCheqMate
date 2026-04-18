// =============================================================================
// PAYMENT VERIFICATION API - Confirms payment status with Stripe
// Called by the success page as a fallback if webhook hasn't processed yet.
// Uses idempotent checks to prevent double-processing.
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { addPremiumTime, addBusinessTime } from "@/lib/cheqs";
import { getStripeKeys } from "@/lib/stripe-config";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    // Get Stripe keys
    const keys = await getStripeKeys();
    if (!keys.secretKey) {
      return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
    }

    const stripe = new Stripe(keys.secretKey, { apiVersion: "2026-02-25.clover" });

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (!checkoutSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify this session belongs to the current user
    const paymentId = checkoutSession.metadata?.paymentId;
    const sessionUserId = checkoutSession.metadata?.userId;

    if (sessionUserId !== session.user.id) {
      console.warn(`Payment verify: user mismatch. Session user: ${sessionUserId}, request user: ${session.user.id}`);
      return NextResponse.json({ error: "Payment does not belong to this user" }, { status: 403 });
    }

    if (!paymentId) {
      return NextResponse.json({ error: "Invalid payment session" }, { status: 400 });
    }

    // Check if payment is already completed (idempotency)
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // Already processed - return current status
    if (existingPayment.status === "completed") {
      // Fetch current user status to return
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { accountType: true, premiumExpiresAt: true },
      });

      return NextResponse.json({
        status: "completed",
        alreadyProcessed: true,
        paymentType: existingPayment.type,
        accountType: user?.accountType,
        premiumExpiresAt: user?.premiumExpiresAt,
        message: "Payment was already processed successfully.",
      });
    }

    // Check Stripe payment status
    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json({
        status: "pending",
        stripeStatus: checkoutSession.payment_status,
        message: "Payment has not been confirmed by Stripe yet.",
      });
    }

    // Payment is paid in Stripe but not processed locally - process it now
    // This is the critical fallback when the webhook didn't fire or failed
    console.log(`Payment verify: Processing missed payment ${paymentId} for user ${session.user.id}`);

    const paymentType = checkoutSession.metadata?.type;
    const months = parseInt(checkoutSession.metadata?.months || "0");
    const cheqsToAward = parseInt(checkoutSession.metadata?.cheqsToAward || "0");

    if (paymentType === "premium_subscription" && months > 0) {
      // Process premium subscription
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "completed",
          stripePaymentId: checkoutSession.payment_intent as string,
          completedAt: new Date(),
        },
      });

      const newExpiration = await addPremiumTime(session.user.id, months);

      // Log the activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "premium_purchased_via_verify",
          details: JSON.stringify({
            paymentId,
            amount: checkoutSession.amount_total,
            months,
            newExpiration,
            source: "verify_fallback",
          }),
        },
      });

      console.log(`Payment verify: Premium added - ${months} months for user ${session.user.id}, expires ${newExpiration}`);

      return NextResponse.json({
        status: "completed",
        alreadyProcessed: false,
        paymentType: "premium_subscription",
        months,
        accountType: "premium",
        premiumExpiresAt: newExpiration,
        message: `Premium activated for ${months} month${months > 1 ? "s" : ""}!`,
      });
    } else if (paymentType === "business_subscription" && months > 0) {
      // Process business subscription
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "completed",
          stripePaymentId: checkoutSession.payment_intent as string,
          completedAt: new Date(),
        },
      });

      const newExpiration = await addBusinessTime(session.user.id, months);

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "business_purchased_via_verify",
          details: JSON.stringify({
            paymentId,
            amount: checkoutSession.amount_total,
            months,
            newExpiration,
            source: "verify_fallback",
          }),
        },
      });

      console.log(`Payment verify: Business added - ${months} months for user ${session.user.id}, expires ${newExpiration}`);

      return NextResponse.json({
        status: "completed",
        alreadyProcessed: false,
        paymentType: "business_subscription",
        months,
        accountType: "business",
        premiumExpiresAt: newExpiration,
        message: `Business plan activated for ${months} month${months > 1 ? "s" : ""}!`,
      });
    } else if (paymentType === "storage_addon") {
      // Process storage add-on purchase
      const storageBytes = BigInt(checkoutSession.metadata?.storageBytes || "0");
      const storagePlanId = checkoutSession.metadata?.storagePlanId || null;

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: "completed",
            stripePaymentId: checkoutSession.payment_intent as string,
            completedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: session.user.id },
          data: {
            extraStorageBytes: storageBytes,
            storagePlanId,
          },
        }),
        prisma.activityLog.create({
          data: {
            userId: session.user.id,
            action: "storage_purchased_via_verify",
            details: JSON.stringify({
              paymentId,
              storagePlanId,
              storageBytes: storageBytes.toString(),
              source: "verify_fallback",
            }),
          },
        }),
      ]);

      console.log(`Payment verify: Storage add-on processed - ${storagePlanId} for user ${session.user.id}`);

      return NextResponse.json({
        status: "completed",
        alreadyProcessed: false,
        paymentType: "storage_addon",
        storagePlanId,
        message: `Storage add-on activated!`,
      });
    } else {
      // Process donation/tip - award Cheqs
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: "completed",
            stripePaymentId: checkoutSession.payment_intent as string,
            completedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: session.user.id },
          data: { cheqs: { increment: cheqsToAward } },
        }),
        prisma.activityLog.create({
          data: {
            userId: session.user.id,
            action: "payment_completed_via_verify",
            details: JSON.stringify({
              paymentId,
              amount: checkoutSession.amount_total,
              cheqsAwarded: cheqsToAward,
              source: "verify_fallback",
            }),
          },
        }),
      ]);

      console.log(`Payment verify: Donation processed - ${cheqsToAward} Cheqs for user ${session.user.id}`);

      return NextResponse.json({
        status: "completed",
        alreadyProcessed: false,
        paymentType: paymentType || "donation",
        cheqsAwarded: cheqsToAward,
        message: `Payment confirmed! ${cheqsToAward} Cheqs awarded.`,
      });
    }
  } catch (error) {
    console.error("Payment verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
