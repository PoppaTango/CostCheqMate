# CostCheqMate

## MVP fast-track setup

This section is the shortest path to an MVP-ready environment.

### 1) Configure environment files

From repository root:

```bash
cp .env.example .env
cp mobile/.env.example mobile/.env
```

Then edit:

- `.env`
  - `DATABASE_URL`
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET` (or `JWT_SECRET`)
- `mobile/.env`
  - `EXPO_PUBLIC_API_BASE_URL`

### 2) Run MVP readiness check

```bash
npm run mvp:check
```

If any checks fail, fill missing values and run it again.

### 3) Apply database migration

```bash
npx prisma migrate dev --name add-premium-trial-limit-setting
```

### 4) Verify the new premium trial admin flow

1. Open Moderator Panel -> Settings.
2. Update **Free Premium Actions / Month**.
3. Use a free test account and confirm:
   - premium actions decrement usage,
   - hard stop when limit is reached,
   - upgrade CTA appears,
   - moderator user list shows usage + reset date.

### 5) MVP launch-critical environment checklist

Before production release, ensure these are set:

- Core auth/database:
  - `DATABASE_URL`
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`
- Mobile:
  - `EXPO_PUBLIC_API_BASE_URL`
- Payments:
  - Stripe keys (via env or moderator Stripe settings)
  - Apple IAP server secrets (`APPLE_IAP_*`)
- OCR + notifications:
  - `ABACUSAI_API_KEY`
  - `WEB_APP_ID`

### 6) Password reset flow

If a user cannot sign in and needs a password reset:

1. Go to `/forgot-password`
2. Submit account email
3. Open reset link from email
4. Set new password at `/reset-password`

If `NOTIF_ID_PASSWORD_RESET` is not configured yet, reset links are logged server-side in backend logs as:

`[PASSWORD_RESET_LINK] user@example.com -> https://.../reset-password?token=...`

