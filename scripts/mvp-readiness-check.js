#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");

const checks = [
  {
    label: "Root .env exists",
    target: path.join(workspaceRoot, ".env"),
    required: false,
    help: "Create /workspace/.env from .env.example",
  },
  {
    label: "Mobile .env exists",
    target: path.join(workspaceRoot, "mobile", ".env"),
    required: false,
    help: "Create /workspace/mobile/.env from mobile/.env.example",
  },
  {
    label: "Prisma schema present",
    target: path.join(workspaceRoot, "prisma", "schema.prisma"),
    required: true,
  },
  {
    label: "Mobile entry route exists",
    target: path.join(workspaceRoot, "mobile", "app", "index.tsx"),
    required: true,
  },
  {
    label: "Password reset API route exists",
    target: path.join(workspaceRoot, "app", "api", "auth", "forgot-password", "route.ts"),
    required: true,
  },
];

let hasRequiredFailure = false;

console.log("Cost CheqMate MVP readiness check\n");

for (const check of checks) {
  const exists = fs.existsSync(check.target);
  const status = exists ? "PASS" : check.required ? "FAIL" : "WARN";
  console.log(`[${status}] ${check.label}: ${check.target}`);
  if (!exists && check.help) {
    console.log(`       -> ${check.help}`);
  }
  if (!exists && check.required) {
    hasRequiredFailure = true;
  }
}

console.log("\nNext steps:");
console.log("1) Ensure .env files are populated with production values.");
console.log("2) Run: npx prisma migrate dev --name add-password-reset-and-mvp-stability");
console.log("3) Run: npm run build");
console.log("4) Run mobile in Expo with: cd mobile && npm run start");

if (hasRequiredFailure) {
  console.error("\nReadiness check failed: required files are missing.");
  process.exit(1);
}

console.log("\nReadiness check completed.");
