import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getUserCloudConnections } from "@/lib/cloud-storage";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: auth.userId,
      actionType: "cloud_storage_action",
      consume: false,
      metadata: { endpoint: "GET /api/mobile/cloud-storage/status" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json({
        connections: [],
        upgradeRequired: true,
        requiredPlan: "premium",
        premiumTrial: trialDecision.status,
      });
    }

    const connections = await getUserCloudConnections(auth.userId);
    const result = connections.map((connection) => ({
      id: connection.id,
      provider: connection.provider,
      accountEmail: connection.accountEmail,
      accountName: connection.accountName,
      isActive: connection.isActive,
      yearFolderId: connection.yearFolderId,
      yearFolderName: connection.yearFolderName,
      connectedAt: connection.createdAt,
      lastUsed: connection.updatedAt,
    }));

    return NextResponse.json({ connections: result });
  } catch (error) {
    console.error("Mobile cloud storage status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
