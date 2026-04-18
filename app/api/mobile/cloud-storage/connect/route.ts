import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getGoogleDriveAuthUrl, getOneDriveAuthUrl } from "@/lib/cloud-storage";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: auth.userId,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: { endpoint: "POST /api/mobile/cloud-storage/connect" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud storage connect requires Premium. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    // Share latest trial snapshot to let clients refresh UI counters.
    const premiumTrial = trialDecision.status;

    const body = await request.json();
    const provider = String(body?.provider || "");
    if (!["onedrive", "googledrive"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const stateToken = randomBytes(32).toString("hex");
    const state = `${auth.userId}:${stateToken}`;
    const authUrl =
      provider === "onedrive" ? getOneDriveAuthUrl(state) : getGoogleDriveAuthUrl(state);

    return NextResponse.json({ authUrl, state, provider, premiumTrial });
  } catch (error) {
    console.error("Mobile cloud connect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
