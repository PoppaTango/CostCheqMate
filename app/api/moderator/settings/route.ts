// =============================================================================
// SYSTEM SETTINGS API - Global application settings
// GET: Fetch current settings
// PUT: Update settings (owner only)
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOwner, isAdmin } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// GET - Fetch system settings (admin+ can view, limited for others)
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's role
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get or create system settings
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'system_settings' },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { id: 'system_settings' },
      });
    }

    // Non-admins get limited information
    if (!isAdmin(currentUser.role)) {
      return NextResponse.json({
        settings: {
          siteName: settings.siteName,
          maintenanceMode: settings.maintenanceMode,
          maintenanceMessage: settings.maintenanceMessage,
          registrationEnabled: settings.registrationEnabled,
          welcomeMessage: settings.welcomeMessage,
          stripeEnabled: settings.stripeEnabled,
        },
      });
    }

    // Admins see everything
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT - Update system settings (owner only for sensitive settings)
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's role
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !isAdmin(currentUser.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();

    // Separate sensitive settings (owner only) from general settings
    const sensitiveFields = ['paymentEmail', 'paymentPhone', 'premiumPrice', 'stripeEnabled'];
    const updateData: Record<string, unknown> = {};

    // Process each field in the body
    for (const [key, value] of Object.entries(body)) {
      // Skip sensitive fields if not owner
      if (sensitiveFields.includes(key) && !isOwner(currentUser.role)) {
        continue;
      }
      updateData[key] = value;
    }

    // Upsert settings (create if doesn't exist)
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'system_settings' },
      update: updateData,
      create: {
        id: 'system_settings',
        ...updateData,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
