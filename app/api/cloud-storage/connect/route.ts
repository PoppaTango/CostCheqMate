export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOneDriveAuthUrl, getGoogleDriveAuthUrl } from "@/lib/cloud-storage";
import { randomBytes } from "crypto";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

// Initiate OAuth flow for OneDrive or Google Drive
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await request.json();
    if (!provider || !["onedrive", "googledrive"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const access = await evaluatePremiumFeatureAccess({
      userId: session.user.id,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: {
        endpoint: "POST /api/cloud-storage/connect",
        provider,
      },
    });
    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud storage linking is a Premium feature. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: access.status,
        },
        { status: 403 }
      );
    }

    // Create state token with userId embedded for security
    const stateToken = randomBytes(32).toString("hex");
    const state = `${session.user.id}:${stateToken}`;

    let authUrl: string;
    if (provider === "onedrive") {
      authUrl = getOneDriveAuthUrl(state);
    } else {
      authUrl = getGoogleDriveAuthUrl(state);
    }

    return NextResponse.json({ authUrl, state });
  } catch (error) {
    console.error("Cloud storage connect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
