export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeGoogleDriveCode, getGoogleProfile } from "@/lib/cloud-storage";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Google Drive OAuth error:", error);
      return NextResponse.redirect(
        new URL("/dashboard?tab=cloud-storage&error=oauth_denied", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard?tab=cloud-storage&error=missing_params", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
      );
    }

    const userId = state.split(":")[0];
    if (!userId) {
      return NextResponse.redirect(
        new URL("/dashboard?tab=cloud-storage&error=invalid_state", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
      );
    }

    const tokens = await exchangeGoogleDriveCode(code);
    const profile = await getGoogleProfile(tokens.access_token);

    await prisma.cloudStorageConnection.upsert({
      where: {
        userId_provider: { userId, provider: "googledrive" },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: profile.email,
        accountName: profile.name,
        isActive: true,
        rootFolderId: null,
      },
      create: {
        userId,
        provider: "googledrive",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: profile.email,
        accountName: profile.name,
        isActive: true,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard?tab=cloud-storage&success=googledrive", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
    );
  } catch (error) {
    console.error("Google Drive callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?tab=cloud-storage&error=callback_failed", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
    );
  }
}
