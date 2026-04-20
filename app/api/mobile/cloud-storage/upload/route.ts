import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { ensureSubfolder, getUserCloudConnection, uploadToCloudStorage } from "@/lib/cloud-storage";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const access = await evaluatePremiumFeatureAccess({
      userId: auth.userId,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: { endpoint: "POST /api/mobile/cloud-storage/upload" },
    });
    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud storage backup is a Premium feature. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: access.status,
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryName = String(formData.get("categoryName") || "").trim();
    const provider = String(formData.get("provider") || "").trim();
    const categoryId = String(formData.get("categoryId") || "").trim() || null;
    const clientFileName = String(formData.get("fileName") || "").trim();

    if (!file || !categoryName) {
      return NextResponse.json(
        { error: "file and categoryName are required" },
        { status: 400 }
      );
    }

    let connection;
    if (provider) {
      connection = await prisma.cloudStorageConnection.findFirst({
        where: { userId: auth.userId, provider, isActive: true },
      });
    } else {
      connection = await getUserCloudConnection(auth.userId);
    }

    if (!connection) {
      return NextResponse.json(
        { error: "No cloud storage connected" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = clientFileName || file.name || `receipt-${Date.now()}.pdf`;

    let overrideFolderId: string | null = null;
    if (connection.yearFolderId) {
      try {
        overrideFolderId = await ensureSubfolder(connection.id, connection.yearFolderId, categoryName);
      } catch (error) {
        console.error("Mobile cloud upload year-folder subfolder error:", error);
      }
    }

    if (!overrideFolderId && categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId: auth.userId },
        select: { cloudFolderId: true },
      });
      if (category?.cloudFolderId) {
        overrideFolderId = category.cloudFolderId;
      }
    }

    const result = await uploadToCloudStorage(
      connection.id,
      categoryName,
      fileName,
      buffer,
      file.type || "application/octet-stream",
      overrideFolderId
    );

    return NextResponse.json({
      success: true,
      ...result,
      premiumTrial: access.status,
    });
  } catch (error) {
    console.error("Mobile cloud upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
