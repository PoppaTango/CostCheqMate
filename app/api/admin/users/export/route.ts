export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!currentUser?.isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    // Fetch all users for CSV export
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        cheqs: true,
        isAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate CSV
    const csvHeaders = "id,name,email,account_type,cheqs,is_admin,created_at";
    const csvRows = users.map((user) => {
      const name = (user.name || "").replace(/,/g, " ");
      const email = user.email || "";
      const createdAt = user.createdAt.toISOString();
      return `${user.id},${name},${email},${user.accountType},${user.cheqs},${user.isAdmin},${createdAt}`;
    });
    const csv = [csvHeaders, ...csvRows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="costcheqmate_users_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
