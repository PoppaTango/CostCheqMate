export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Get current year folder setting
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await prisma.cloudStorageConnection.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { yearFolderId: true, yearFolderName: true, provider: true },
    });

    if (!connection) {
      return NextResponse.json({ yearFolderId: null, yearFolderName: null });
    }

    return NextResponse.json({
      yearFolderId: connection.yearFolderId,
      yearFolderName: connection.yearFolderName,
      provider: connection.provider,
    });
  } catch (error) {
    console.error("Get year folder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Set the active year folder
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { yearFolderId, yearFolderName } = await request.json();

    const connection = await prisma.cloudStorageConnection.findFirst({
      where: { userId: session.user.id, isActive: true },
    });

    if (!connection) {
      return NextResponse.json({ error: "No cloud storage connected" }, { status: 400 });
    }

    await prisma.cloudStorageConnection.update({
      where: { id: connection.id },
      data: {
        yearFolderId: yearFolderId || null,
        yearFolderName: yearFolderName || null,
      },
    });

    return NextResponse.json({
      success: true,
      yearFolderId: yearFolderId || null,
      yearFolderName: yearFolderName || null,
    });
  } catch (error) {
    console.error("Set year folder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
