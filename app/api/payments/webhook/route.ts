// =============================================================================
// STRIPE WEBHOOK API - Handle Stripe webhook events
// Processes payment completion, updates database, awards Cheqs
// Handles premium subscription payments with addPremiumTime
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { addPremiumTime, addBusinessTime } from "@/lib/cheqs";
import { getStripeKeys } from "@/lib/stripe-config";

// -----------------------------------------------------------------------------
// POST - Handle Stripe webhook events
// Verifies signature and processes checkout.session.completed
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Get Stripe keys from DB first, then env vars
    const keys = await getStripeKeys();
    if (!keys.webhookSecret || !keys.secretKey) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 503 }
      );
    }

    const stripe = new Stripe(keys.secretKey, { apiVersion: "2026-02-25.clover" });
    const webhookSecret = keys.webhookSecret;

    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get metadata from session
      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;
      const paymentType = session.metadata?.type;
      const months = parseInt(session.metadata?.months || "0");
      const cheqsToAward = parseInt(session.metadata?.cheqsToAward || "0");

      if (paymentId && userId) {
        // Handle premium subscription payment
        if (paymentType === "premium_subscription" && months > 0) {
          // Mark payment as completed
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: "completed",
              stripePaymentId: session.payment_intent as string,
              completedAt: new Date(),
            },
          });

          // Add premium time to user
          const newExpiration = await addPremiumTime(userId, months);

          // Log the activity
          await prisma.activityLog.create({
            data: {
              userId,
              action: "premium_purchased",
              details: JSON.stringify({
                paymentId,
                amount: session.amount_total,
                months,
                newExpiration,
              }),
            },
          });

          console.log(`Premium subscription: ${paymentId}, added ${months} months to ${userId}, expires ${newExpiration}`);
        } else if (paymentType === "business_subscription" && months > 0) {
          // Handle business subscription payment
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: "completed",
              stripePaymentId: session.payment_intent as string,
              completedAt: new Date(),
            },
          });

          const newExpiration = await addBusinessTime(userId, months);

          await prisma.activityLog.create({
            data: {
              userId,
              action: "business_purchased",
              details: JSON.stringify({
                paymentId,
                amount: session.amount_total,
                months,
                newExpiration,
              }),
            },
          });

          console.log(`Business subscription: ${paymentId}, added ${months} months to ${userId}, expires ${newExpiration}`);
        } else if (paymentType === "storage_addon") {
          // Handle storage add-on purchase
          const storageBytes = BigInt(session.metadata?.storageBytes || "0");
          const storagePlanId = session.metadata?.storagePlanId || null;

          await prisma.$transaction([
            prisma.payment.update({
              where: { id: paymentId },
              data: {
                status: "completed",
                stripePaymentId: session.payment_intent as string,
                completedAt: new Date(),
              },
            }),
            prisma.user.update({
              where: { id: userId },
              data: {
                extraStorageBytes: storageBytes,
                storagePlanId,
              },
            }),
            prisma.activityLog.create({
              data: {
                userId,
                action: "storage_purchased",
                details: JSON.stringify({ paymentId, storagePlanId, storageBytes: storageBytes.toString() }),
              },
            }),
          ]);

          console.log(`Storage addon: ${paymentId}, plan ${storagePlanId} for ${userId}`);
        } else {
          // Handle donation/tip - award Cheqs
          await prisma.$transaction([
            // Mark payment as completed
            prisma.payment.update({
              where: { id: paymentId },
              data: {
                status: "completed",
                stripePaymentId: session.payment_intent as string,
                completedAt: new Date(),
              },
            }),
            // Award Cheqs to user
            prisma.user.update({
              where: { id: userId },
              data: {
                cheqs: { increment: cheqsToAward },
              },
            }),
            // Log the activity
            prisma.activityLog.create({
              data: {
                userId,
                action: "payment_completed",
                details: JSON.stringify({
                  paymentId,
                  amount: session.amount_total,
                  cheqsAwarded: cheqsToAward,
                }),
              },
            }),
          ]);

          console.log(`Payment completed: ${paymentId}, awarded ${cheqsToAward} Cheqs to ${userId}`);
        }
      }
    }

    // Handle payment_intent.payment_failed event
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Find and update the payment record
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentId: paymentIntent.id },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "failed" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
