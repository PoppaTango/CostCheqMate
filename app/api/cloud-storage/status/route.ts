export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserCloudConnections } from "@/lib/cloud-storage";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: session.user.id,
      actionType: "cloud_storage_action",
      consume: false,
      metadata: { endpoint: "GET /api/cloud-storage/status" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud storage is a Premium feature. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    const connections = await getUserCloudConnections(session.user.id);

    const result = connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      accountEmail: c.accountEmail,
      accountName: c.accountName,
      isActive: c.isActive,
      yearFolderId: c.yearFolderId,
      yearFolderName: c.yearFolderName,
      connectedAt: c.createdAt,
      lastUsed: c.updatedAt,
    }));

    return NextResponse.json({ connections: result });
  } catch (error) {
    console.error("Cloud storage status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
