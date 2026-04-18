import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";

    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
    }

    await revokeRefreshToken(refreshToken);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
