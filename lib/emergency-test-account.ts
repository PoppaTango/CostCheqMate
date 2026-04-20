import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Temporary emergency account for MVP QA unblock.
// Remove this after normal signup/password reset flow is stable.
const EMERGENCY_TEST_ACCOUNT = {
  email: "mvp.tester@costcheqmate.com",
  password: "CostCheqMate!MVP2026",
  name: "MVP Test Account",
};

export function isEmergencyTestCredentials(email: string, password: string) {
  return (
    email.trim().toLowerCase() === EMERGENCY_TEST_ACCOUNT.email &&
    password === EMERGENCY_TEST_ACCOUNT.password
  );
}

type EmergencyAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  accountType: string;
  image: string | null;
  password: string | null;
};

export async function ensureEmergencyTestUser(
  email: string,
  password: string
): Promise<EmergencyAuthUser | null> {
  if (!isEmergencyTestCredentials(email, password)) {
    return null;
  }

  const normalizedEmail = EMERGENCY_TEST_ACCOUNT.email;
  const hashedPassword = await bcrypt.hash(EMERGENCY_TEST_ACCOUNT.password, 12);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: EMERGENCY_TEST_ACCOUNT.name,
      password: hashedPassword,
      role: "admin",
      accountType: "business",
      status: "active",
      isAdmin: true,
      isVerified: true,
      verifiedAt: new Date(),
    },
    create: {
      email: normalizedEmail,
      name: EMERGENCY_TEST_ACCOUNT.name,
      password: hashedPassword,
      role: "admin",
      accountType: "business",
      status: "active",
      isAdmin: true,
      isVerified: true,
      verifiedAt: new Date(),
      cheqs: 5000,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      accountType: true,
      image: true,
      password: true,
    },
  });

  return user;
}

export const emergencyTestAccountCredentials = {
  email: EMERGENCY_TEST_ACCOUNT.email,
  password: EMERGENCY_TEST_ACCOUNT.password,
};
