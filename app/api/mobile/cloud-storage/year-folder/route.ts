import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
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
      metadata: { endpoint: "GET /api/mobile/cloud-storage/year-folder" },
    });
    const connection = await prisma.cloudStorageConnection.findFirst({
      where: { userId: auth.userId, isActive: true },
      select: { provider: true, yearFolderId: true, yearFolderName: true },
    });

    if (!trialDecision.allowed) {
      return NextResponse.json({
        connected: Boolean(connection),
        provider: connection?.provider || null,
        yearFolderId: connection?.yearFolderId || null,
        yearFolderName: connection?.yearFolderName || null,
        upgradeRequired: true,
        requiredPlan: "premium",
        premiumTrial: trialDecision.status,
      });
    }

    return NextResponse.json({
      connected: Boolean(connection),
      provider: connection?.provider || null,
      yearFolderId: connection?.yearFolderId || null,
      yearFolderName: connection?.yearFolderName || null,
    });
  } catch (error) {
    console.error("Mobile cloud year-folder GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: auth.userId,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: { endpoint: "PUT /api/mobile/cloud-storage/year-folder" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud storage year-folder mapping requires Premium. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    const connection = await prisma.cloudStorageConnection.findFirst({
      where: { userId: auth.userId, isActive: true },
      select: { id: true },
    });
    if (!connection) {
      return NextResponse.json({ error: "No cloud storage connected" }, { status: 400 });
    }

    const body = await request.json();
    const yearFolderId = body?.yearFolderId ? String(body.yearFolderId) : null;
    const yearFolderName = body?.yearFolderName ? String(body.yearFolderName) : null;

    await prisma.cloudStorageConnection.update({
      where: { id: connection.id },
      data: { yearFolderId, yearFolderName },
    });

    return NextResponse.json({
      success: true,
      yearFolderId,
      yearFolderName,
    });
  } catch (error) {
    console.error("Mobile cloud year-folder PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
