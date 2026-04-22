# Mobile UI testing fast path

Use this path when your goal is to quickly validate core UI and authentication flows in Expo Go.

## 1) Install dependencies

```bash
cd mobile
npm install --legacy-peer-deps
```

## 2) Configure API URL

Create `mobile/.env` from `mobile/.env.example` and set:

```bash
EXPO_PUBLIC_API_BASE_URL=https://costcheqmate.com
```

For local backend testing, use your machine LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

## 3) Start Expo with tunnel

Tunnel mode avoids many LAN/WSL routing issues:

```bash
npx expo start --tunnel --clear
```

## 4) Open on device

- Install **Expo Go** on iOS/Android.
- Scan the QR code from terminal or Expo DevTools.

## 5) Smoke test checklist

- Login with valid website credentials.
- Open dashboard and run refresh actions.
- Create category and expense.
- Run receipt OCR from camera/gallery.
- Open Stripe checkout URL (Android/web flow).
- Verify iOS checkout guard returns IAP message for premium upgrades.
