export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeOneDriveCode, getMicrosoftProfile } from "@/lib/cloud-storage";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OneDrive OAuth error:", error, url.searchParams.get("error_description"));
      return NextResponse.redirect(
        new URL("/dashboard?tab=cloud-storage&error=oauth_denied", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard?tab=cloud-storage&error=missing_params", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
      );
    }

    // Extract userId from state
    const userId = state.split(":")[0];
    if (!userId) {
      return NextResponse.redirect(
        new URL("/dashboard?tab=cloud-storage&error=invalid_state", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeOneDriveCode(code);

    // Get user profile
    const profile = await getMicrosoftProfile(tokens.access_token);

    // Upsert connection
    await prisma.cloudStorageConnection.upsert({
      where: {
        userId_provider: { userId, provider: "onedrive" },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: profile.email,
        accountName: profile.name,
        isActive: true,
        rootFolderId: null, // Reset so it gets re-created
      },
      create: {
        userId,
        provider: "onedrive",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: profile.email,
        accountName: profile.name,
        isActive: true,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard?tab=cloud-storage&success=onedrive", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
    );
  } catch (error) {
    console.error("OneDrive callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?tab=cloud-storage&error=callback_failed", process.env.NEXTAUTH_URL || "https://costcheqmate.com")
    );
  }
}
