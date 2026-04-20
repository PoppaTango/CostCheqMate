export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPremiumTrialStatusForUser } from "@/lib/premium-trial";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const premiumTrial = await getPremiumTrialStatusForUser(session.user.id);
    return NextResponse.json({ premiumTrial });
  } catch (error) {
    console.error("Premium trial status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
