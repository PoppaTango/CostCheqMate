export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserCloudConnection, listCloudFolders, browseCloudFolders, createCloudFolder, ensureSubfolder } from "@/lib/cloud-storage";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

// List folders — supports both CheqMate root listing and full drive browsing
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: session.user.id,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: { endpoint: "GET /api/cloud-storage/folders" },
    });
    if (!trialDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Cloud storage browsing requires Premium. Free accounts get 10 Premium actions per month.",
          upgradeRequired: true,
          requiredPlan: "premium",
          premiumTrial: trialDecision.status,
        },
        { status: 403 }
      );
    }

    const connection = await getUserCloudConnection(session.user.id);
    if (!connection) {
      return NextResponse.json({ folders: [], connected: false });
    }

    const { searchParams } = new URL(request.url);
    const browse = searchParams.get("browse") === "true";
    const parentId = searchParams.get("parentId");

    let folders;
    if (browse) {
      // Browse any folder level in the actual drive
      folders = await browseCloudFolders(connection.id, parentId || null);
    } else {
      // Default: list folders inside the "Cost CheqMate" root
      folders = await listCloudFolders(connection.id);
    }

    return NextResponse.json({
      folders,
      connected: true,
      provider: connection.provider,
    });
  } catch (error) {
    console.error("List cloud folders error:", error);
    return NextResponse.json({ error: "Failed to list folders" }, { status: 500 });
  }
}

// Create a new folder — inside yearFolder if set, otherwise inside "Cost CheqMate" root
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trialDecision = await evaluatePremiumFeatureAccess({
      userId: session.user.id,
      actionType: "cloud_storage_action",
      consume: true,
      metadata: { endpoint: "POST /api/cloud-storage/folders" },
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

    const { folderName } = await request.json();
    if (!folderName || !folderName.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const connection = await getUserCloudConnection(session.user.id);
    if (!connection) {
      return NextResponse.json(
        { error: "No cloud storage connected" },
        { status: 400 }
      );
    }

    // If a year folder is set, create the subfolder inside it instead of the root
    if (connection.yearFolderId) {
      const folderId = await ensureSubfolder(connection.id, connection.yearFolderId, folderName.trim());
      return NextResponse.json({ folder: { id: folderId, name: folderName.trim() } });
    }

    const folder = await createCloudFolder(connection.id, folderName.trim());
    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Create cloud folder error:", error);
    const message = error instanceof Error ? error.message : "Failed to create folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
