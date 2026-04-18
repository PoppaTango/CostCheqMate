import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileAccessToken } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileAccessToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountType: true,
      status: true,
      premiumExpiresAt: true,
      currency: true,
      fiscalYearStart: true,
      cheqs: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
