// =============================================================================
// ROLE LABELS API - CRUD operations for custom role labels (gamification)
// Only accessible by Admin users
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/moderator";

/**
 * GET /api/admin/role-labels
 * Fetch all role labels for dropdown/selection
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    // Only admin and superusers can view role labels
    if (!user || !['admin', 'superuser'].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const labels = await prisma.roleLabel.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(labels);
  } catch (error) {
    console.error("Get role labels error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/role-labels
 * Create a new role label (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    // Only admin can create role labels
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "Only administrators can create role labels" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, color, icon, displayOrder } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await prisma.roleLabel.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ error: "A label with this name already exists" }, { status: 400 });
    }

    const label = await prisma.roleLabel.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6366f1',
        icon: icon || null,
        displayOrder: displayOrder || 0,
      },
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'role_label_created',
        details: JSON.stringify({ labelId: label.id, name: label.name }),
      },
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    console.error("Create role label error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/role-labels
 * Update an existing role label (Admin only)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "Only administrators can edit role labels" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, description, color, icon, displayOrder, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Label ID is required" }, { status: 400 });
    }

    const label = await prisma.roleLabel.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(label);
  } catch (error) {
    console.error("Update role label error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/role-labels
 * Delete a role label (Admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "Only administrators can delete role labels" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Label ID is required" }, { status: 400 });
    }

    // Clear this label from any users who have it
    await prisma.user.updateMany({
      where: { customRoleLabel: id },
      data: { customRoleLabel: null },
    });

    await prisma.roleLabel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete role label error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
