# CostCheqMate

## MVP fast-track setup

1. Copy environment templates:
   - `cp .env.example .env`
   - `cp mobile/.env.example mobile/.env`
2. Populate required variables (DB/auth/Stripe/email + mobile API URL).
3. Run install and checks:
   - `npm install --legacy-peer-deps`
   - `npm run mvp:check`
4. Run Prisma migration:
   - `npx prisma migrate dev --name add-password-reset-and-mvp-stability`
5. Start web and mobile:
   - Web: `npm run dev`
   - Mobile: `cd mobile && npm install --legacy-peer-deps && npm run start`

## Password reset flow

- Forgot password page: `/forgot-password`
- Reset password page: `/reset-password?token=...`
- API endpoints:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`

If `NOTIF_ID_PASSWORD_RESET` is not set, reset links are logged server-side as:
`[PASSWORD_RESET_LINK] email -> url`
