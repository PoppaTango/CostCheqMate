import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getUserCloudConnections } from "@/lib/cloud-storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
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
