// =============================================================================
// STRIPE CHECKOUT API - Create Stripe Checkout Sessions for payments
// Supports:
// - Monthly premium subscription ($1.99/month)
// - Donations/tips (earn Cheqs based on amount)
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { PREMIUM_MONTHLY_PRICE, BUSINESS_MONTHLY_PRICE } from "@/lib/cheqs";
import { getStripeKeys } from "@/lib/stripe-config";

// Helper function to get Stripe client using DB-first key resolution
async function getStripeClient() {
  const keys = await getStripeKeys();
  if (!keys.secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(keys.secretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

// -----------------------------------------------------------------------------
// POST - Create a Stripe Checkout Session
// Body: { amount, type, note, months } 
// - For premium_subscription: months = number of months to purchase
// - For donations: amount = donation amount
// Returns: { sessionId, url } for redirect
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Stripe client (reads keys from DB first, then env vars)
    let stripe: Stripe;
    try {
      stripe = await getStripeClient();
    } catch {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount, type, note, months = 1 } = body;

    // Get the origin for success/cancel URLs
    const origin = request.headers.get("origin") || "";

    // Handle premium subscription purchase
    if (type === "premium_subscription") {
      const monthsToAdd = Math.max(1, Math.min(12, parseInt(months) || 1)); // 1-12 months
      const totalAmount = PREMIUM_MONTHLY_PRICE * monthsToAdd;

      // ── Duplicate payment prevention ──
      // Block if there's a pending premium payment created in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentPending = await prisma.payment.findFirst({
        where: {
          userId: session.user.id,
          type: "premium_subscription",
          status: "pending",
          createdAt: { gte: fiveMinutesAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentPending) {
        // If there's already a pending session, redirect to that one instead of creating a new charge
        if (recentPending.stripeSessionId) {
          try {
            const existingSession = await stripe.checkout.sessions.retrieve(recentPending.stripeSessionId);
            // If the session is still open, reuse it
            if (existingSession.status === "open" && existingSession.url) {
              return NextResponse.json({
                sessionId: existingSession.id,
                url: existingSession.url,
                months: monthsToAdd,
                totalAmount,
                reused: true,
              });
            }
          } catch {
            // Session expired or invalid — allow creating a new one below
          }
        }
        // If session is expired but payment is still pending, mark it as expired
        if (recentPending.stripeSessionId) {
          await prisma.payment.update({
            where: { id: recentPending.id },
            data: { status: "expired", note: "Session expired before completion" },
          });
        }
      }

      // Also block if user already has active premium (prevent accidental double-purchase)
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { accountType: true, premiumExpiresAt: true },
      });
      if (currentUser?.accountType === "premium" && currentUser.premiumExpiresAt && new Date(currentUser.premiumExpiresAt) > new Date()) {
        return NextResponse.json(
          { error: "You already have an active premium subscription. It expires on " + new Date(currentUser.premiumExpiresAt).toLocaleDateString() + "." },
          { status: 409 }
        );
      }

      // Create a payment record for subscription
      const payment = await prisma.payment.create({
        data: {
          userId: session.user.id,
          amount: totalAmount,
          currency: "CAD",
          type: "premium_subscription",
          status: "pending",
          cheqsAwarded: 0, // Premium subscription doesn't award Cheqs
          note: `${monthsToAdd} month(s) premium subscription`,
          metadata: JSON.stringify({ months: monthsToAdd }),
        },
      });

      // Create Stripe Checkout Session for subscription
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "cad",
              product_data: {
                name: "Cost CheqMate Premium — One-Time Purchase",
                description: `${monthsToAdd} month${monthsToAdd > 1 ? 's' : ''} of premium features. This is a one-time payment — you will NOT be charged again automatically.`,
              },
              unit_amount: Math.round(totalAmount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
        customer_email: session.user.email || undefined,
        metadata: {
          paymentId: payment.id,
          userId: session.user.id,
          type: "premium_subscription",
          months: monthsToAdd.toString(),
        },
      });

      // Update payment with Stripe session ID
      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: checkoutSession.id },
      });

      return NextResponse.json({
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        months: monthsToAdd,
        totalAmount,
      });
    }

    // Handle business subscription purchase
    if (type === "business_subscription") {
      const monthsToAdd = Math.max(1, Math.min(12, parseInt(months) || 1));
      const totalAmount = BUSINESS_MONTHLY_PRICE * monthsToAdd;

      // Duplicate payment prevention
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentPending = await prisma.payment.findFirst({
        where: {
          userId: session.user.id,
          type: "business_subscription",
          status: "pending",
          createdAt: { gte: fiveMinutesAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentPending) {
        return NextResponse.json({
          error: "A business subscription payment is already in progress. Please wait a moment.",
          existingPaymentId: recentPending.id,
        }, { status: 409 });
      }

      const payment = await prisma.payment.create({
        data: {
          userId: session.user.id,
          amount: totalAmount,
          currency: "CAD",
          type: "business_subscription",
          status: "pending",
          note: `Business plan: ${monthsToAdd} month${monthsToAdd > 1 ? "s" : ""}`,
        },
      });

      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "cad",
              product_data: {
                name: `Cost CheqMate for Business — ${monthsToAdd} Month${monthsToAdd > 1 ? "s" : ""}`,
                description: `Business plan with Excel exports, data analytics, custom branding, and all premium features`,
              },
              unit_amount: Math.round(totalAmount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
        customer_email: session.user.email || undefined,
        metadata: {
          paymentId: payment.id,
          userId: session.user.id,
          months: monthsToAdd.toString(),
          type: "business_subscription",
        },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: checkoutSession.id },
      });

      return NextResponse.json({
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        months: monthsToAdd,
        totalAmount,
      });
    }

    // Handle storage add-on purchase
    if (type === "storage_addon") {
      const { storagePlanId } = body;
      const storageTiers: Record<string, { gb: number; price: number; label: string }> = {
        storage_5gb:   { gb: 5,   price: 1.49,  label: "Starter (5 GB)" },
        storage_25gb:  { gb: 25,  price: 4.99,  label: "Professional (25 GB)" },
        storage_100gb: { gb: 100, price: 14.99, label: "Enterprise (100 GB)" },
      };

      const tier = storageTiers[storagePlanId];
      if (!tier) {
        return NextResponse.json({ error: "Invalid storage plan" }, { status: 400 });
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          userId: session.user.id,
          amount: tier.price,
          currency: "CAD",
          type: "storage_addon",
          status: "pending",
          note: `Storage add-on: ${tier.label}`,
        },
      });

      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "cad",
              product_data: {
                name: `Cost CheqMate Storage — ${tier.label}`,
                description: `${tier.gb} GB of extra server storage for receipt PDFs (monthly)`,
              },
              unit_amount: Math.round(tier.price * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
        customer_email: session.user.email || undefined,
        metadata: {
          paymentId: payment.id,
          userId: session.user.id,
          type: "storage_addon",
          storagePlanId,
          storageBytes: (tier.gb * 1024 * 1024 * 1024).toString(),
        },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: checkoutSession.id },
      });

      return NextResponse.json({
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      });
    }

    // Handle donation/tip payments
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount < 1 || paymentAmount > 1000) {
      return NextResponse.json(
        { error: "Invalid amount. Must be between $1 and $1000" },
        { status: 400 }
      );
    }

    // Get system settings for Cheqs per dollar
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: "system_settings" },
    });
    const cheqsPerDollar = systemSettings?.cheqsPerDollar || 10;
    const cheqsToAward = Math.floor(paymentAmount * cheqsPerDollar);

    // Create a payment record in pending state
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        amount: paymentAmount,
        currency: "CAD",
        type: type || "donation",
        status: "pending",
        cheqsAwarded: cheqsToAward,
        note: note || null,
      },
    });

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: "Support Cost CheqMate",
              description: `Thank you for your support! You'll earn ${cheqsToAward} Cheqs.`,
            },
            unit_amount: Math.round(paymentAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancel`,
      customer_email: session.user.email || undefined,
      metadata: {
        paymentId: payment.id,
        userId: session.user.id,
        cheqsToAward: cheqsToAward.toString(),
        type: type || "donation",
      },
    });

    // Update payment with Stripe session ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    // Return session URL for redirect
    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
