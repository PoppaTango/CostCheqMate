import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.category.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const body = await request.json();
    const nextName = body?.name !== undefined ? String(body.name).trim() : existing.name;
    if (!nextName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: nextName,
        icon: body?.icon !== undefined ? String(body.icon || "") || existing.icon : existing.icon,
        color:
          body?.color !== undefined ? String(body.color || "") || existing.color : existing.color,
        annualBudget:
          body?.annualBudget !== undefined ? Number(body.annualBudget || 0) : existing.annualBudget,
        bankAccountId:
          body?.bankAccountId !== undefined
            ? (body.bankAccountId ? String(body.bankAccountId) : null)
            : existing.bankAccountId,
        cloudFolderId:
          body?.cloudFolderId !== undefined
            ? (body.cloudFolderId ? String(body.cloudFolderId) : null)
            : existing.cloudFolderId,
        cloudFolderName:
          body?.cloudFolderName !== undefined
            ? (body.cloudFolderName ? String(body.cloudFolderName) : null)
            : existing.cloudFolderName,
      },
      include: { bankAccount: true },
    });

    const logMutation = createMutationLoggerFromHeaders(request.headers, auth.userId, "mobile");
    await logMutation({
      entityType: "category",
      entityId: category.id,
      operation: "update",
      payload: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        annualBudget: category.annualBudget,
        bankAccountId: category.bankAccountId,
        cloudFolderId: category.cloudFolderId,
        cloudFolderName: category.cloudFolderName,
        updatedAt: category.updatedAt.toISOString(),
      },
    });

    return NextResponse.json({ category });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Category name already exists" }, { status: 400 });
    }
    console.error("Mobile category update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.category.findFirst({
      where: { id, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await prisma.category.delete({ where: { id } });

    const logMutation = createMutationLoggerFromHeaders(request.headers, auth.userId, "mobile");
    await logMutation({
      entityType: "category",
      entityId: id,
      operation: "delete",
      payload: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile category delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
