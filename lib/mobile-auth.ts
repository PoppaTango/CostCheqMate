import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_DAYS = 30;

export const mobileTokenTtlMs = ACCESS_TOKEN_TTL_SECONDS * 1000;
export const refreshTokenTtlMs = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

interface MobileAccessTokenPayload extends JwtPayload {
  type: "access";
  sub: string;
  deviceId: string;
  email: string | null;
  name: string | null;
  role: string;
}

type MobileIdentity = {
  id: string;
  email: string | null;
  name?: string | null;
  role: string;
};

function getMobileJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or JWT_SECRET must be configured");
  }
  return secret;
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueMobileRefreshToken() {
  return randomBytes(48).toString("hex");
}

export function issueMobileAccessToken(input: {
  userId: string;
  deviceId: string;
  email: string | null;
  name: string | null;
  role?: string;
}) {
  return jwt.sign(
    {
      type: "access",
      sub: input.userId,
      deviceId: input.deviceId,
      email: input.email,
      name: input.name,
      role: input.role || "free",
    },
    getMobileJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: "costcheqmate-api",
      audience: "costcheqmate-mobile",
    }
  );
}

export function parseMobileAccessToken(token: string): MobileAccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, getMobileJwtSecret(), {
      issuer: "costcheqmate-api",
      audience: "costcheqmate-mobile",
    });
    if (!payload || typeof payload !== "object" || payload.type !== "access") {
      return null;
    }
    return payload as MobileAccessTokenPayload;
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function extractBearerToken(request: Request) {
  return getBearerToken(request);
}

export async function resolveMobileSession(token: string) {
  const payload = parseMobileAccessToken(token);
  if (!payload?.sub || !payload.deviceId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, status: true },
  });
  if (!user || ["banned", "suspended"].includes(user.status)) return null;

  return { userId: payload.sub, deviceId: payload.deviceId, payload };
}

export async function authenticateMobileAccessToken(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  if (!token) return null;

  const session = await resolveMobileSession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountType: true,
      status: true,
      image: true,
    },
  });
  if (!user || ["banned", "suspended"].includes(user.status)) return null;

  await prisma.mobileDevice.updateMany({
    where: { userId: user.id, deviceId: session.deviceId },
    data: { lastSeenAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    accountType: user.accountType,
    image: user.image,
    deviceId: session.deviceId,
  };
}

export async function requireMobileAuth(request: Request) {
  const user = await authenticateMobileAccessToken(request.headers.get("authorization"));
  if (!user) {
    return { ok: false as const, error: "Unauthorized" };
  }
  return { ok: true as const, userId: user.id, deviceId: user.deviceId, user };
}

export async function validateCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      password: true,
      accountType: true,
      image: true,
    },
  });

  if (!user?.password) return null;
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return null;
  if (["suspended", "banned"].includes(user.status)) {
    return { blocked: true as const, user };
  }
  return { blocked: false as const, user };
}

async function upsertDevice(params: {
  userId: string;
  deviceId: string;
  platform: string;
  appVersion?: string | null;
  pushToken?: string | null;
}) {
  const { userId, deviceId, platform, appVersion, pushToken } = params;

  return prisma.mobileDevice.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    update: {
      platform,
      appVersion: appVersion || null,
      pushToken: pushToken || null,
      lastSeenAt: new Date(),
    },
    create: {
      userId,
      deviceId,
      platform,
      appVersion: appVersion || null,
      pushToken: pushToken || null,
      lastSeenAt: new Date(),
    },
  });
}

async function createRefreshTokenRecord(userId: string, mobileDeviceId: string) {
  const refreshToken = issueMobileRefreshToken();
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs);

  await prisma.mobileRefreshToken.create({
    data: {
      userId,
      mobileDeviceId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
      lastUsedAt: new Date(),
    },
  });

  return { refreshToken, expiresAt };
}

export async function issueMobileTokens(params: {
  user?: MobileIdentity & { name?: string | null };
  userId?: string;
  deviceId: string;
  platform: string;
  appVersion?: string | null;
  pushToken?: string | null;
}) {
  let identity: MobileIdentity | null = params.user ?? null;
  if (!identity) {
    if (!params.userId) throw new Error("user or userId is required");
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new Error("User not found");
    identity = user;
  }
  if (!identity) {
    throw new Error("Unable to resolve user identity");
  }

  const device = await upsertDevice({
    userId: identity.id,
    deviceId: params.deviceId,
    platform: params.platform,
    appVersion: params.appVersion ?? null,
    pushToken: params.pushToken ?? null,
  });

  await prisma.mobileRefreshToken.updateMany({
    where: { mobileDeviceId: device.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const refresh = await createRefreshTokenRecord(identity.id, device.id);
  const accessToken = issueMobileAccessToken({
    userId: identity.id,
    deviceId: device.deviceId,
    email: identity.email,
    name: identity.name ?? null,
    role: identity.role,
  });

  await prisma.user.update({
    where: { id: identity.id },
    data: {
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      loginCount: { increment: 1 },
    },
  });

  return {
    accessToken,
    refreshToken: refresh.refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
  };
}

export async function rotateRefreshToken(params: {
  refreshToken: string;
  deviceId: string;
  appVersion?: string | null;
  pushToken?: string | null;
}) {
  const tokenHash = hashRefreshToken(params.refreshToken);
  const current = await prisma.mobileRefreshToken.findUnique({
    where: { tokenHash },
    include: {
      mobileDevice: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accountType: true,
          status: true,
          image: true,
        },
      },
    },
  });

  if (!current || current.revokedAt || current.expiresAt <= new Date()) return null;
  if (current.mobileDevice.deviceId !== params.deviceId) return null;
  if (["banned", "suspended"].includes(current.user.status)) return null;

  const newRefreshToken = issueMobileRefreshToken();
  const newRefreshHash = hashRefreshToken(newRefreshToken);
  const newRefreshExpiresAt = new Date(Date.now() + refreshTokenTtlMs);

  const accessToken = issueMobileAccessToken({
    userId: current.user.id,
    deviceId: current.mobileDevice.deviceId,
    email: current.user.email,
    name: current.user.name,
    role: current.user.role,
  });

  await prisma.$transaction([
    prisma.mobileRefreshToken.update({
      where: { id: current.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    }),
    prisma.mobileRefreshToken.create({
      data: {
        userId: current.user.id,
        mobileDeviceId: current.mobileDeviceId,
        tokenHash: newRefreshHash,
        expiresAt: newRefreshExpiresAt,
        lastUsedAt: new Date(),
      },
    }),
    prisma.mobileDevice.update({
      where: { id: current.mobileDeviceId },
      data: {
        appVersion: params.appVersion || current.mobileDevice.appVersion,
        pushToken: params.pushToken || current.mobileDevice.pushToken,
        lastSeenAt: new Date(),
      },
    }),
  ]);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresAt: newRefreshExpiresAt.toISOString(),
    user: {
      id: current.user.id,
      email: current.user.email,
      name: current.user.name,
      role: current.user.role,
      accountType: current.user.accountType,
      image: current.user.image,
    },
  };
}

export async function revokeRefreshToken(refreshToken: string) {
  await prisma.mobileRefreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await prisma.mobileRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
