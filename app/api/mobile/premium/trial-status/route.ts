import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getPremiumTrialStatusForUser } from "@/lib/premium-trial";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const premiumTrial = await getPremiumTrialStatusForUser(auth.userId);
    return NextResponse.json({ premiumTrial });
  } catch (error) {
    console.error("Mobile premium trial status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
