// =============================================================================
// STRIPE CONFIGURATION HELPER
// Reads Stripe keys from DB (SystemSettings) first, falls back to env vars
// =============================================================================

import { prisma } from "@/lib/db";

export interface StripeKeys {
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
}

/**
 * Get Stripe keys: DB settings take priority, env vars as fallback.
 */
export async function getStripeKeys(): Promise<StripeKeys> {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "system_settings" },
      select: {
        stripePublishableKey: true,
        stripeSecretKey: true,
        stripeWebhookSecret: true,
      },
    });

    return {
      publishableKey:
        settings?.stripePublishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
      secretKey:
        settings?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || null,
      webhookSecret:
        settings?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || null,
    };
  } catch {
    // Fallback to env vars if DB is unavailable
    return {
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
      secretKey: process.env.STRIPE_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
    };
  }
}

/**
 * Mask a key for display: show first 7 + last 4 chars
 */
export function maskKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 12) return "••••••••";
  return key.substring(0, 7) + "••••••••" + key.slice(-4);
}
