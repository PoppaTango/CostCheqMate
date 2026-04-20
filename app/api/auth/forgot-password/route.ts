export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { issuePasswordResetToken } from "@/lib/password-reset";
import { sendNotificationEmail } from "@/lib/notifications";

const genericResponse = {
  message:
    "If an account exists for this email, a password reset link has been sent.",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const issued = await issuePasswordResetToken(email);
    if (!issued.user || !issued.rawToken) {
      return NextResponse.json(genericResponse);
    }

    const baseUrl = process.env.NEXTAUTH_URL || "https://costcheqmate.com";
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(
      issued.rawToken
    )}`;
    const recipientEmail = issued.user.email;
    if (!recipientEmail) {
      return NextResponse.json(genericResponse);
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Reset your Cost CheqMate password</h2>
        <p style="line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background:#0ea5e9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset Password
          </a>
        </p>
        <p style="line-height: 1.6; font-size: 13px; color: #64748b;">
          This link expires in 60 minutes. If you did not request this, you can ignore this email.
        </p>
        <p style="line-height: 1.6; font-size: 13px; color: #64748b;">
          If the button does not work, copy and paste this URL into your browser:<br/>
          ${resetLink}
        </p>
      </div>
    `;

    if (process.env.NOTIF_ID_PASSWORD_RESET) {
      await sendNotificationEmail(
        process.env.NOTIF_ID_PASSWORD_RESET,
        recipientEmail,
        "Reset your Cost CheqMate password",
        html
      );
    } else {
      // Temporary MVP fallback: log reset link server-side when email provider is not configured.
      console.warn(`[PASSWORD_RESET_LINK] ${recipientEmail} -> ${resetLink}`);
    }

    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
