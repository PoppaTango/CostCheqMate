## CostCheqMate Mobile (Expo)

This folder contains the initial iOS/Android mobile app scaffold for CostCheqMate.

### Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI (optional): `npm i -g expo-cli`

### Setup

```bash
cd mobile
npm install
```

### Configure API URL

Create and edit mobile env file:

```bash
cp .env.example .env
```

Set:

- `EXPO_PUBLIC_API_BASE_URL`
  - Production: `https://costcheqmate.com`
  - Local dev: `http://<your-local-ip>:3000` (mobile emulator cannot use host localhost)

### Run

```bash
npm run start
```

Then press:

- `i` for iOS simulator
- `a` for Android emulator
- or scan QR code with Expo Go

### Release prep (EAS)

1. Install Expo + EAS CLIs (if missing):

```bash
npm i -g expo-cli eas-cli
```

2. Sign in and validate config:

```bash
eas login
npm run release:doctor
```

3. Internal test builds:

```bash
npm run release:preview:ios
npm run release:preview:android
```

4. Production builds:

```bash
npm run release:prod:ios
npm run release:prod:android
```

5. Submission commands:

```bash
npm run submit:ios
npm run submit:android
```

See:
- `docs/ui-testing-fast-path.md` for quickest device UI testing setup
- `docs/release-runbook.md` for full build/submit flow
- `docs/store-submission-checklist.md` for submission gates
- `docs/store-listing-draft.md` for copy-ready listing text

### Included foundation

- Secure mobile auth token storage (`expo-secure-store`)
- Login with device-bound token issuance (`/api/mobile/auth/login`)
- Refresh token rotation (`/api/mobile/auth/refresh`)
- Profile fetch (`/api/mobile/me`)
- Basic sync pull (`/api/mobile/sync/changes`)

### Next implementation steps

1. Replace placeholder `deviceId` with real native installation/device identifier.
2. Add biometric gate with `expo-local-authentication`.
3. Add offline queue + SQLite persistence for local-first mutations.
4. Build feature screens (Dashboard, Expenses, Categories, OCR upload, Payments, Cloud Storage).
5. Add iOS StoreKit IAP for premium/business in the iOS build.
