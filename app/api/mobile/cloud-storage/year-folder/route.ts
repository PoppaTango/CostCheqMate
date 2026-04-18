import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const connection = await prisma.cloudStorageConnection.findFirst({
      where: { userId: auth.userId, isActive: true },
      select: { provider: true, yearFolderId: true, yearFolderName: true },
    });

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
