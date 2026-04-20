# CostCheqMate Mobile Release Runbook (MVP)

Use this runbook to get from "code ready" to internal testing and store submission.

## 0) Preconditions

- Repository branch is up to date.
- Backend API is deployed and reachable.
- Root `.env` and `mobile/.env` are configured.
- Apple and Google developer accounts are active.

## 1) One-time local setup

From `mobile/`:

```bash
npm install
npm i -g eas-cli
eas login
```

Validate Expo config:

```bash
npm run release:doctor
```

Note: in this monorepo layout, `expo-doctor` may report a duplicate React package from the web workspace root (`../node_modules/react`). The mobile package itself is pinned to the correct Expo SDK-compatible versions in `mobile/package.json`, and EAS cloud builds resolve from `mobile/` dependencies.

## 2) Verify runtime env

Ensure `mobile/.env` includes:

- `EXPO_PUBLIC_API_BASE_URL=https://your-production-domain`

For local API testing on device/emulator, use LAN IP (not `localhost`).

## 3) Build internal test artifacts

### iOS (internal)

```bash
npm run release:preview:ios
```

### Android (internal APK)

```bash
npm run release:preview:android
```

Distribute these builds to QA/stakeholders and validate:

- login + biometric lock
- OCR flows
- offline queue + sync behavior
- cloud storage connect/upload
- premium trial quota + CTA behavior
- Stripe (Android/web) and Apple IAP (iOS) entitlement flow

## 4) Build production artifacts

### iOS production build

```bash
npm run release:prod:ios
```

### Android AAB production build

```bash
npm run release:prod:android
```

## 5) Submit to stores

### App Store Connect

```bash
npm run submit:ios
```

### Google Play Console

```bash
npm run submit:android
```

## 6) Post-submit verification checklist

- Confirm app listing text/screenshots match current app behavior.
- Confirm privacy policy URL and support URL are valid.
- Confirm account deletion path is documented in listing.
- Confirm IAP products and server verification are live in production.
- Confirm backend webhooks / logs show successful payment events.

## 7) Rollback/Hotfix path

If a blocker is found after submission:

1. Create hotfix branch.
2. Patch and ship new production build with incremented app version.
3. Resubmit build to the same track (TestFlight/Internal Testing first).
