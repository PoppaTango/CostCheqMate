# Mobile release runbook

## Prerequisites

- Apple Developer and Google Play Console accounts configured.
- EAS CLI authenticated (`npx eas whoami`).
- `.env` configured for API base URL and auth/payment keys.

## Verify local state

```bash
cd mobile
npm install --legacy-peer-deps
npm run typecheck
npm run release:doctor
```

## Build internal test artifacts

```bash
cd mobile
npm run release:preview
```

- Install the generated iOS build through TestFlight internal testers.
- Install the generated Android build through Internal Testing (Play Console).

## Build production artifacts

```bash
cd mobile
npm run release:prod
```

## Submit

```bash
cd mobile
npm run submit:ios
npm run submit:android
```

## Post-submit checks

- Confirm mobile login works with existing website accounts.
- Confirm iOS upgrade uses Apple IAP path.
- Confirm Android upgrade uses checkout redirect path.
- Confirm receipt OCR works with camera and gallery uploads.
- Confirm cloud storage connect/disconnect and folder mapping.
