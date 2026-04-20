# CostCheqMate Store Submission Checklist (MVP)

Use this as the source of truth before shipping to App Store and Google Play.

## 1) App identity

- App name: `Cost CheqMate`
- iOS bundle ID: `com.costcheqmate.mobile`
- Android package: `com.costcheqmate.mobile`
- Version in `app.json` is updated for this release.

## 2) Required links

- Privacy policy URL
- Terms of service URL
- Support URL/email
- Account deletion instructions URL/path

## 3) Authentication and account requirements

- Login works for free and premium accounts.
- Account creation flow works.
- Account deletion is available and documented.
- Password reset flow is confirmed.
- App review test credentials are prepared (if requested by reviewers).

## 4) Payments and entitlements

- iOS:
  - Apple IAP products created and approved (or ready for review).
  - Server-side receipt verification environment variables set:
    - `APPLE_IAP_BUNDLE_ID`
    - `APPLE_IAP_ISSUER_ID`
    - `APPLE_IAP_KEY_ID`
    - `APPLE_IAP_PRIVATE_KEY`
    - optional: `APPLE_IAP_SHARED_SECRET`
  - Premium/business entitlement updates correctly after purchase.
- Android/Web:
  - Stripe checkout works.
  - Stripe webhook events are processed.
  - Payment history updates after successful payment.

## 5) MVP critical functional checks

- Expense create/edit/delete
- Category create/edit/delete
- OCR receipt scan
- Cloud storage connect/upload
- Offline queue + flush
- Sync pull/push parity with web
- Premium trial limit enforcement + upgrade CTA

## 6) Assets and listing content

- App icon and splash are final.
- Screenshots for phone sizes are ready (iOS + Android).
- Short description and full description are ready.
- Keywords/category selected.
- Content rating questionnaire complete.

## 7) Compliance declarations

- Data collection declarations match real behavior.
- Encryption/privacy declarations completed.
- Ads tracking declarations correct.
- Permissions requested in app are justified in listing notes.

## 8) Release gates (must pass)

- `npm run release:doctor` passes
- Preview builds installed and smoke tested
- Production builds complete (iOS + Android)
- Submission metadata completed in both stores

## 9) Launch-day monitoring

- Error logs monitored for auth, sync, OCR, payments
- Support inbox monitored
- Rollback/hotfix owner assigned

## Metadata template (fill before submit)

### iOS App Store

- Subtitle:
- Promotional text:
- Description:
- Keywords:
- Support URL:
- Marketing URL:
- Privacy policy URL:
- App Review notes (test login + special steps):

### Google Play

- Short description:
- Full description:
- App category:
- Contact email:
- Privacy policy URL:
- Data safety form completed:
- Content rating completed:

## Screenshot checklist

- iOS screenshots exported for required iPhone sizes.
- Android phone screenshots exported for Play listing.
- Screenshots reflect current premium CTA and core flows.
