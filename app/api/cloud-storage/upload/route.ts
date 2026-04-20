export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserCloudConnection, uploadToCloudStorage } from "@/lib/cloud-storage";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

// Upload a file to user's connected cloud storage
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryName = formData.get("categoryName") as string;
    const provider = formData.get("provider") as string | null;
    const clientFileName = formData.get("fileName") as string | null;
    const categoryId = formData.get("categoryId") as string | null;

    if (!file || !categoryName) {
      return NextResponse.json({ error: "File and category name are required" }, { status: 400 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: session.user.id,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: { endpoint: "POST /api/cloud-storage/upload", categoryName },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud backup requires Premium. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    // Get user's active connection (prefer specified provider)
    let connection;
    if (provider) {
      const { prisma } = await import("@/lib/db");
      connection = await prisma.cloudStorageConnection.findFirst({
        where: { userId: session.user.id, provider, isActive: true },
      });
    } else {
      connection = await getUserCloudConnection(session.user.id);
    }

    if (!connection) {
      return NextResponse.json(
        { error: "No cloud storage connected. Please connect OneDrive or Google Drive first." },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use client-provided filename if available, otherwise generate a fallback
    let fileName: string;
    if (clientFileName) {
      fileName = clientFileName;
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const ext = file.name.split(".").pop() || "pdf";
      fileName = `receipt_${timestamp}.${ext}`;
    }

    // Determine upload folder: year folder > category mapping > auto-create
    let overrideFolderId: string | null = null;
    let folderDisplayName = categoryName;
    const { prisma: db } = await import("@/lib/db");

    // First check if a year folder is set — if so, auto-create category subfolder inside it
    if (connection.yearFolderId) {
      const { ensureSubfolder } = await import("@/lib/cloud-storage");
      try {
        const catFolderId = await ensureSubfolder(connection.id, connection.yearFolderId, categoryName);
        overrideFolderId = catFolderId;
        folderDisplayName = `${connection.yearFolderName || "Year"} → ${categoryName}`;
      } catch (err) {
        console.error("Failed to create category subfolder in year folder:", err);
        // Fall through to other methods
      }
    }

    // If no year folder or that failed, check category's mapped folder
    if (!overrideFolderId && categoryId) {
      const cat = await db.category.findFirst({
        where: { id: categoryId, userId: session.user.id },
        select: { cloudFolderId: true, cloudFolderName: true },
      });
      if (cat?.cloudFolderId) {
        overrideFolderId = cat.cloudFolderId;
        folderDisplayName = cat.cloudFolderName || categoryName;
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

    const providerName = result.provider === "onedrive" ? "OneDrive" : "Google Drive";
    const pathDisplay = connection.yearFolderId
      ? `${providerName} → ${folderDisplayName}`
      : `${providerName} → Cost CheqMate → ${folderDisplayName}`;

    return NextResponse.json({
      success: true,
      ...result,
      message: `Receipt saved to ${pathDisplay}`,
    });
  } catch (error) {
    console.error("Cloud storage upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
