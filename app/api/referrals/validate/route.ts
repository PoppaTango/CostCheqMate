// =============================================================================
// REFERRAL VALIDATION API - Validate referral code during signup
// POST: Validate and get referrer info from referral code
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// -----------------------------------------------------------------------------
// POST - Validate referral code
// Body: { referralCode }
// Returns: { valid, referrerName } or error
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json(
        { valid: false, error: "Referral code is required" },
        { status: 400 }
      );
    }

    // Find user with this referral code
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      select: { id: true, name: true },
    });

    if (!referrer) {
      return NextResponse.json(
        { valid: false, error: "Invalid referral code" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      referrerId: referrer.id,
      referrerName: referrer.name || "A friend",
    });
  } catch (error) {
    console.error("Error validating referral code:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate referral code" },
      { status: 500 }
    );
  }
}
