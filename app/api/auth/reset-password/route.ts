export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    const newPassword = String(body?.newPassword || "");

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const consumed = await consumePasswordResetToken({ token, newPassword });
    if (!consumed.ok) {
      return NextResponse.json({ error: consumed.error }, { status: 400 });
    }

    return NextResponse.json({
      message: "Password reset successful. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
