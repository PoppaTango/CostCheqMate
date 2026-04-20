#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const mobileDir = path.join(rootDir, "mobile");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const entries = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep < 0) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    entries[key] = value;
  }

  return entries;
}

function hasMeaningfulValue(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim();
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  if (
    lower.includes("replace-with") ||
    lower === "changeme" ||
    lower === "todo"
  ) {
    return false;
  }

  return true;
}

function formatStatus(ok, label, detail = "") {
  const prefix = ok ? "PASS" : "FAIL";
  return `${prefix} ${label}${detail ? ` - ${detail}` : ""}`;
}

const rootEnv = readEnvFile(path.join(rootDir, ".env"));
const rootExampleEnv = readEnvFile(path.join(rootDir, ".env.example"));
const mobileEnv = readEnvFile(path.join(mobileDir, ".env"));
const mobileExampleEnv = readEnvFile(path.join(mobileDir, ".env.example"));

const checks = [];

checks.push({
  ok: fs.existsSync(path.join(rootDir, ".env.example")),
  label: "Root env template present (.env.example)",
});

checks.push({
  ok: fs.existsSync(path.join(mobileDir, ".env.example")),
  label: "Mobile env template present (mobile/.env.example)",
});

checks.push({
  ok: fs.existsSync(path.join(rootDir, ".env")),
  label: "Root .env present",
  hint: "Copy .env.example -> .env and fill required values",
});

checks.push({
  ok: fs.existsSync(path.join(mobileDir, ".env")),
  label: "Mobile .env present",
  hint: "Copy mobile/.env.example -> mobile/.env and set EXPO_PUBLIC_API_BASE_URL",
});

const requiredRootKeys = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
];

for (const key of requiredRootKeys) {
  const value = rootEnv[key];
  checks.push({
    ok: hasMeaningfulValue(value),
    label: `Root env key ${key}`,
    hint: !hasMeaningfulValue(value)
      ? `.env is missing ${key}; template value: ${rootExampleEnv[key] || "(empty)"}`
      : "",
  });
}

const mobileApiBase = mobileEnv.EXPO_PUBLIC_API_BASE_URL;
checks.push({
  ok: hasMeaningfulValue(mobileApiBase),
  label: "Mobile env key EXPO_PUBLIC_API_BASE_URL",
  hint: !hasMeaningfulValue(mobileApiBase)
    ? `mobile/.env template value: ${
        mobileExampleEnv.EXPO_PUBLIC_API_BASE_URL || "(empty)"
      }`
    : "",
});

checks.push({
  ok: fs.existsSync(path.join(rootDir, "prisma", "schema.prisma")),
  label: "Prisma schema present",
});

checks.push({
  ok: fs.existsSync(path.join(rootDir, "app", "api", "mobile")),
  label: "Mobile API routes present",
});

let failed = 0;
console.log("=== CostCheqMate MVP Readiness Check ===");
for (const check of checks) {
  if (!check.ok) failed += 1;
  console.log(formatStatus(check.ok, check.label, check.ok ? "" : check.hint));
}

if (failed > 0) {
  console.log("");
  console.log(`Result: ${failed} check(s) failed.`);
  console.log("Runbook:");
  console.log("1) Fill .env and mobile/.env from templates.");
  console.log(
    "2) Run: npx prisma migrate dev --name add-premium-trial-limit-setting"
  );
  console.log("3) Re-run: npm run mvp:check");
  process.exit(1);
}

console.log("");
console.log("Result: all checks passed. MVP environment baseline is ready.");
