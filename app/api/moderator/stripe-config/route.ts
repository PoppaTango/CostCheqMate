// =============================================================================
// STRIPE CONFIG API - Manage Stripe keys from moderator panel
// GET: Return masked keys + connection status (owner only)
// PUT: Update keys (owner only)
// POST: Test Stripe connection (owner only)
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/moderator";
import { getStripeKeys, maskKey } from "@/lib/stripe-config";

// Helper: verify owner access
async function verifyOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !isOwner(user.role)) return null;
  return session.user;
}

// GET - Return masked keys and connection status
export async function GET() {
  try {
    const owner = await verifyOwner();
    if (!owner) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const keys = await getStripeKeys();

    return NextResponse.json({
      publishableKey: maskKey(keys.publishableKey),
      secretKey: maskKey(keys.secretKey),
      webhookSecret: maskKey(keys.webhookSecret),
      hasPublishableKey: !!keys.publishableKey,
      hasSecretKey: !!keys.secretKey,
      hasWebhookSecret: !!keys.webhookSecret,
      isConnected: !!keys.publishableKey && !!keys.secretKey,
      webhookUrl: `${process.env.NEXTAUTH_URL || "https://costcheqmate.com"}/api/payments/webhook`,
    });
  } catch (error) {
    console.error("Error fetching Stripe config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update Stripe keys
export async function PUT(request: NextRequest) {
  try {
    const owner = await verifyOwner();
    if (!owner) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const body = await request.json();
    const { publishableKey, secretKey, webhookSecret } = body;

    // Validate key prefixes if provided
    if (publishableKey && !publishableKey.startsWith("pk_")) {
      return NextResponse.json({ error: "Publishable key must start with pk_" }, { status: 400 });
    }
    if (secretKey && !secretKey.startsWith("sk_")) {
      return NextResponse.json({ error: "Secret key must start with sk_" }, { status: 400 });
    }
    if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
      return NextResponse.json({ error: "Webhook secret must start with whsec_" }, { status: 400 });
    }

    // Build update data - only update fields that were provided
    const updateData: Record<string, string> = {};
    if (publishableKey !== undefined) updateData.stripePublishableKey = publishableKey;
    if (secretKey !== undefined) updateData.stripeSecretKey = secretKey;
    if (webhookSecret !== undefined) updateData.stripeWebhookSecret = webhookSecret;

    await prisma.systemSettings.upsert({
      where: { id: "system_settings" },
      update: updateData,
      create: { id: "system_settings", ...updateData },
    });

    // Return updated masked info
    const keys = await getStripeKeys();
    return NextResponse.json({
      publishableKey: maskKey(keys.publishableKey),
      secretKey: maskKey(keys.secretKey),
      webhookSecret: maskKey(keys.webhookSecret),
      hasPublishableKey: !!keys.publishableKey,
      hasSecretKey: !!keys.secretKey,
      hasWebhookSecret: !!keys.webhookSecret,
      isConnected: !!keys.publishableKey && !!keys.secretKey,
    });
  } catch (error) {
    console.error("Error updating Stripe config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Test Stripe connection
export async function POST() {
  try {
    const owner = await verifyOwner();
    if (!owner) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const keys = await getStripeKeys();
    if (!keys.secretKey) {
      return NextResponse.json({ error: "No secret key configured", connected: false }, { status: 400 });
    }

    // Try to create a Stripe instance and fetch account info
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(keys.secretKey, { apiVersion: "2026-02-25.clover" });

    const account = await stripe.accounts.retrieve();

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      businessName: account.business_profile?.name || account.settings?.dashboard?.display_name || "Connected",
      country: account.country,
      currency: account.default_currency,
      livemode: !keys.secretKey.includes("_test_"),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Connection failed";
    console.error("Stripe connection test failed:", message);
    return NextResponse.json({ connected: false, error: message }, { status: 400 });
  }
}
