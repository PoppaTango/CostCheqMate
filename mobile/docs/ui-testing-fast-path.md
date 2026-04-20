# CostCheqMate UI Testing Fast Path

This is the quickest way to get you testing the mobile UI with minimal setup.

## Goal

Get CostCheqMate running on your phone in the shortest path possible.

## What I need from you (only 3 things)

1. **Your backend URL** (production or staging), for example:
   - `https://costcheqmate.com`
2. **One test user account** you can log in with
   - free account preferred first
3. **Your phone type**
   - iPhone, Android, or both

Once you provide those, you can start UI testing right away.

## Quick setup

From repository root:

```bash
cp mobile/.env.example mobile/.env
```

Edit `mobile/.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=https://costcheqmate.com
```

## Run on your device (fastest)

From `mobile/`:

```bash
npm install
npm run start
```

Then:
- install **Expo Go** on your phone
- scan the QR code from terminal
- log in with your test account

## First UI smoke test list (10-15 minutes)

1. Login screen works.
2. Dashboard loads without crash.
3. Add expense manually.
4. Edit/delete expense.
5. Category create/edit/delete.
6. OCR scan flow opens camera/gallery.
7. Premium trial usage panel appears.
8. Biometric lock toggle works.
9. Offline queue shows pending item when network is off.
10. Reconnect and sync/flush works.

## If app fails to connect

- Confirm `EXPO_PUBLIC_API_BASE_URL` is correct and reachable from phone.
- Do not use `localhost` for device testing.
- Use HTTPS URL for remote environments.
- Ensure backend mobile auth routes are reachable:
  - `/api/mobile/auth/login`
  - `/api/mobile/me`

