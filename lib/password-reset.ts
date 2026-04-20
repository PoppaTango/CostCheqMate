import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const RESET_TOKEN_TTL_MINUTES = 60;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  return randomBytes(48).toString("hex");
}

export async function issuePasswordResetToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true },
  });

  // Never reveal account existence to callers.
  if (!user) {
    return { ok: true as const, user: null, rawToken: null };
  }

  const rawToken = createPasswordResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return { ok: true as const, user, rawToken };
}

export async function consumePasswordResetToken(input: {
  token: string;
  newPassword: string;
}) {
  const tokenHash = hashResetToken(input.token.trim());
  const now = new Date();

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, status: true, email: true, name: true },
      },
    },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= now ||
    ["banned", "suspended"].includes(resetToken.user.status)
  ) {
    return { ok: false as const, error: "Invalid or expired reset token" };
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    }),
  ]);

  return { ok: true as const, user: resetToken.user };
}

