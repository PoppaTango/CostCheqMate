import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileAccessToken } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { getStripeKeys } from "@/lib/stripe-config";
import { PREMIUM_MONTHLY_PRICE, BUSINESS_MONTHLY_PRICE } from "@/lib/cheqs";

export const dynamic = "force-dynamic";

type CheckoutBody = {
  amount?: number;
  type?: string;
  months?: number;
  note?: string;
  platform?: "ios" | "android";
  returnUrlSuccess?: string;
  returnUrlCancel?: string;
};

function isAllowedReturnUrl(url: string) {
  if (!url) return false;
  if (url.startsWith("costcheqmate://")) return true;
  if (url.startsWith("https://costcheqmate.com")) return true;
  if (url.startsWith("https://www.costcheqmate.com")) return true;
  return false;
}

async function getStripeClient() {
  const keys = await getStripeKeys();
  if (!keys.secretKey) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(keys.secretKey, { apiVersion: "2026-02-25.clover" });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateMobileAccessToken(request.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutBody;
    const requestedAmount = Number(body.amount || 0);
    const type = body.type || "donation";
    const note = body.note || null;
    const months = Math.max(1, Math.min(12, Number(body.months || 1)));
    const amount =
      type === "premium_subscription"
        ? PREMIUM_MONTHLY_PRICE * months
        : type === "business_subscription"
          ? BUSINESS_MONTHLY_PRICE * months
          : requestedAmount;

    const successUrl = body.returnUrlSuccess || "";
    const cancelUrl = body.returnUrlCancel || "";

    if (!isAllowedReturnUrl(successUrl) || !isAllowedReturnUrl(cancelUrl)) {
      return NextResponse.json(
        { error: "Invalid return URLs for mobile checkout" },
        { status: 400 }
      );
    }

    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const stripe = await getStripeClient();
    const payment = await prisma.payment.create({
      data: {
        userId: auth.id,
        amount,
        currency: "CAD",
        type,
        status: "pending",
        note,
        metadata: JSON.stringify({
          platform: body.platform || "ios",
          months,
          source: "mobile",
        }),
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
              name: type === "premium_subscription" ? "Cost CheqMate Premium" : "Cost CheqMate",
              description:
                type === "premium_subscription"
                  ? `${months} month${months > 1 ? "s" : ""} premium access`
                  : "Cost CheqMate payment",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: auth.email || undefined,
      metadata: {
        paymentId: payment.id,
        userId: auth.id,
        type,
        months: String(months),
        source: "mobile",
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return NextResponse.json({
      paymentId: payment.id,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Mobile checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
