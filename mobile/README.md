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

Set your API base URL in `src/config.ts`:

- Production: `https://costcheqmate.com`
- Local dev: `http://<your-local-ip>:3000` (mobile emulator cannot use localhost from host machine)

### Run

```bash
npm run start
```

Then press:

- `i` for iOS simulator
- `a` for Android emulator
- or scan QR code with Expo Go

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
