export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { issueMobileTokens, validateCredentials } from "@/lib/mobile-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const deviceId = String(body?.deviceId || "").trim();
    const platform = String(body?.platform || "").trim().toLowerCase();
    const appVersion = body?.appVersion ? String(body.appVersion) : null;
    const pushToken = body?.pushToken ? String(body.pushToken) : null;

    if (!email || !password || !deviceId || !platform) {
      return NextResponse.json(
        { error: "email, password, deviceId, and platform are required" },
        { status: 400 }
      );
    }

    const result = await validateCredentials(email, password);
    if (!result) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (result.blocked) {
      return NextResponse.json(
        { error: `Account is ${result.user.status}` },
        { status: 403 }
      );
    }

    const user = result.user;
    const tokens = await issueMobileTokens({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      deviceId,
      platform,
      appVersion,
      pushToken,
    });

    return NextResponse.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
