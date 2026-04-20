import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  browseCloudFolders,
  createCloudFolder,
  ensureSubfolder,
  getUserCloudConnection,
  listCloudFolders,
} from "@/lib/cloud-storage";
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
      metadata: { endpoint: "GET /api/mobile/cloud-storage/folders" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json({
        connected: false,
        folders: [],
        upgradeRequired: true,
        requiredPlan: "premium",
        premiumTrial: trialDecision.status,
      });
    }

    const connection = await getUserCloudConnection(auth.userId);
    if (!connection) {
      return NextResponse.json({ folders: [], connected: false });
    }

    const browse = request.nextUrl.searchParams.get("browse") === "true";
    const parentId = request.nextUrl.searchParams.get("parentId");
    const folders = browse
      ? await browseCloudFolders(connection.id, parentId || null)
      : await listCloudFolders(connection.id);

    return NextResponse.json({
      connected: true,
      provider: connection.provider,
      folders,
    });
  } catch (error) {
    console.error("Mobile cloud folders list error:", error);
    return NextResponse.json({ error: "Failed to list folders" }, { status: 500 });
  }
}

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
      metadata: { endpoint: "POST /api/mobile/cloud-storage/folders" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud folder creation requires Premium. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const folderName = String(body?.folderName || "").trim();
    if (!folderName) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const connection = await getUserCloudConnection(auth.userId);
    if (!connection) {
      return NextResponse.json({ error: "No cloud storage connected" }, { status: 400 });
    }

    if (connection.yearFolderId) {
      const folderId = await ensureSubfolder(connection.id, connection.yearFolderId, folderName);
      return NextResponse.json({ folder: { id: folderId, name: folderName } }, { status: 201 });
    }

    const folder = await createCloudFolder(connection.id, folderName);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Mobile cloud folder create error:", error);
    const message = error instanceof Error ? error.message : "Failed to create folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
