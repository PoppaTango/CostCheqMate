import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const refreshToken = String(body?.refreshToken || "");
    const deviceId = String(body?.deviceId || "");
    const appVersion = body?.appVersion ? String(body.appVersion) : undefined;
    const pushToken = body?.pushToken ? String(body.pushToken) : undefined;

    if (!refreshToken || !deviceId) {
      return NextResponse.json(
        { error: "refreshToken and deviceId are required" },
        { status: 400 }
      );
    }

    const rotated = await rotateRefreshToken({
      refreshToken,
      deviceId,
      appVersion,
      pushToken,
    });

    if (!rotated) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    return NextResponse.json({
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresIn: rotated.accessTokenExpiresIn,
      refreshTokenExpiresAt: rotated.refreshTokenExpiresAt,
      user: rotated.user,
    });
  } catch (error) {
    console.error("Mobile refresh error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
