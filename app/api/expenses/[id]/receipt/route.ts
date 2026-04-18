export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

// Build a standard download filename: YYYY-MM-DD - MerchantName - Amount.ext
function buildReceiptFilename(expense: {
  date: Date | string;
  merchant: string | null;
  amount: number;
  receiptKey?: string | null;
  receiptUrl?: string | null;
  category?: { name: string } | null;
}): string {
  const d = new Date(expense.date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const place = (expense.merchant || expense.category?.name || "Receipt")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, " ");

  const amount = expense.amount.toFixed(2);

  // Determine extension from key/url
  const key = expense.receiptKey || expense.receiptUrl || "";
  const ext = key.toLowerCase().endsWith(".pdf") ? "pdf" : "jpg";

  return `${dateStr} - ${place} - ${amount}.${ext}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode"); // "download" or default (view)

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        receiptKey: true,
        receiptUrl: true,
        date: true,
        merchant: true,
        amount: true,
        category: { select: { name: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const cloud_storage_path = expense.receiptKey || expense.receiptUrl;

    if (!cloud_storage_path) {
      return NextResponse.json({ error: "No receipt attached" }, { status: 404 });
    }

    const filename = buildReceiptFilename(expense);

    if (mode === "download") {
      // Force-download with proper filename
      const downloadUrl = await getFileUrl(cloud_storage_path, false, "attachment", filename);
      return NextResponse.json({ url: downloadUrl, filename });
    }

    // Default: inline viewing (PDF renders in iframe, images render in img tag)
    const viewUrl = await getFileUrl(cloud_storage_path, false, "inline");
    return NextResponse.json({ url: viewUrl, filename });
  } catch (error) {
    console.error("Get receipt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
