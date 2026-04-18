// =============================================================================
// BUSINESS LOGO API - Upload and manage business logo for Business accounts
// PNG only, minimum 200x200, max 5MB
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePresignedUploadUrl, deleteFile, getFileUrl } from "@/lib/s3";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSION = 200; // minimum 200x200
const ALLOWED_TYPES = ["image/png"];

// GET - Get current business logo info
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        accountType: true,
        businessName: true,
        businessLogoUrl: true,
        businessLogoKey: true,
      },
    });

    if (!user || user.accountType !== "business") {
      return NextResponse.json({ error: "Business account required" }, { status: 403 });
    }

    let logoUrl = user.businessLogoUrl;
    // If we have a key but no URL, generate a public URL
    if (user.businessLogoKey && !logoUrl) {
      logoUrl = await getFileUrl(user.businessLogoKey, true);
    }

    return NextResponse.json({
      businessName: user.businessName,
      businessLogoUrl: logoUrl,
      hasLogo: !!user.businessLogoKey,
    });
  } catch (error) {
    console.error("Error fetching business logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Get presigned URL for logo upload
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountType: true, businessLogoKey: true },
    });

    if (!user || user.accountType !== "business") {
      return NextResponse.json({ error: "Business account required" }, { status: 403 });
    }

    const body = await request.json();
    const { fileName, contentType, fileSize, width, height, businessName } = body;

    // Validate file type
    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Only PNG files are accepted for business logos. Please upload a .png file." },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 5MB. Your file is ${(fileSize / 1024 / 1024).toFixed(1)}MB.` },
        { status: 400 }
      );
    }

    // Validate dimensions
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return NextResponse.json(
        { error: `Logo must be at least ${MIN_DIMENSION}x${MIN_DIMENSION} pixels. Your image is ${width}x${height}.` },
        { status: 400 }
      );
    }

    // Delete old logo if exists
    if (user.businessLogoKey) {
      try {
        await deleteFile(user.businessLogoKey);
      } catch {
        console.warn("Failed to delete old business logo");
      }
    }

    // Generate presigned URL for public upload
    const sanitizedName = `business-logo-${session.user.id}-${Date.now()}.png`;
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      sanitizedName,
      contentType,
      true // public
    );

    // Update business name if provided
    if (businessName !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { businessName: businessName || null },
      });
    }

    return NextResponse.json({
      uploadUrl,
      cloud_storage_path,
    });
  } catch (error) {
    console.error("Error creating logo upload URL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Confirm logo upload and save URL
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { cloud_storage_path, businessName } = body;

    if (!cloud_storage_path) {
      return NextResponse.json({ error: "Missing cloud_storage_path" }, { status: 400 });
    }

    // Get public URL
    const publicUrl = await getFileUrl(cloud_storage_path, true);

    const updateData: Record<string, unknown> = {
      businessLogoKey: cloud_storage_path,
      businessLogoUrl: publicUrl,
    };
    if (businessName !== undefined) {
      updateData.businessName = businessName || null;
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      businessLogoUrl: publicUrl,
      cloud_storage_path,
    });
  } catch (error) {
    console.error("Error confirming logo upload:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Remove business logo
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { businessLogoKey: true },
    });

    if (user?.businessLogoKey) {
      try {
        await deleteFile(user.businessLogoKey);
      } catch {
        console.warn("Failed to delete business logo from storage");
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        businessLogoUrl: null,
        businessLogoKey: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting business logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
