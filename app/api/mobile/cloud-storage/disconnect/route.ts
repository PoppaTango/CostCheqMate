import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { provider?: string };
    const provider = String(body.provider || "").toLowerCase();

    if (!provider || !["onedrive", "googledrive"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    await prisma.cloudStorageConnection.updateMany({
      where: {
        userId: auth.userId,
        provider,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile cloud storage disconnect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
