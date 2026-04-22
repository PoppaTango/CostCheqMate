# Store Submission Checklist

Use this checklist before TestFlight / Play Internal distribution.

## App identity
- iOS bundle identifier set in `app.json`
- Android package name set in `app.json`
- App name, icon, splash validated

## Required links
- Privacy policy URL available
- Terms URL available (if required by store category)
- Support contact email available

## Auth requirements
- Login works
- Signup works
- Forgot password works from web
- Suspended/banned users are blocked

## Payments
- Android uses mobile Stripe checkout handoff
- iOS uses Apple IAP verify endpoint
- Recurring pricing copy matches website policies

## Functional MVP checks
- Expense create/update/delete
- Category create/update/delete
- OCR upload and extraction path works
- Cloud connect/disconnect path works
- Mobile sync endpoint reachable

## Compliance
- Data export endpoint available on website
- Account deletion policy documented
- Privacy disclosures aligned with real data usage
