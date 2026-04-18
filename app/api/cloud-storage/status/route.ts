export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserCloudConnections } from "@/lib/cloud-storage";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
