export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMutationLoggerFromHeaders } from "@/lib/mobile-sync";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, icon, color, annualBudget, bankAccountId, cloudFolderId, cloudFolderName } = body;

    const { id } = await params;

    const existing = await prisma.category.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        icon: icon ?? existing.icon,
        color: color ?? existing.color,
        annualBudget: annualBudget ?? existing.annualBudget,
        bankAccountId: bankAccountId !== undefined ? bankAccountId : existing.bankAccountId,
        cloudFolderId: cloudFolderId !== undefined ? cloudFolderId : existing.cloudFolderId,
        cloudFolderName: cloudFolderName !== undefined ? cloudFolderName : existing.cloudFolderName,
      },
      include: { bankAccount: true },
    });

    await logMutation({
      entityType: "category",
      entityId: category.id,
      operation: "update",
      payload: category,
    });

    return NextResponse.json(category);
  } catch (error: any) {
    console.error("Update category error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.category.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await prisma.category.delete({ where: { id } });

    const logMutation = createMutationLoggerFromHeaders(req.headers, session.user.id);
    await logMutation({
      entityType: "category",
      entityId: id,
      operation: "delete",
    });

    return NextResponse.json({ message: "Category deleted" });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
