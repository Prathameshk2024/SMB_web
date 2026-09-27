# Google Play submission: the policy answers

What the Play Console asks about data and policies, answered from what the
code does. The privacy policy (`frontend/src/legal/`) says the same things in
words a user reads; if one changes, change the other.

**Have a lawyer read the policies before the first public release.** They
were written to match the code and Indian law as of September 2026, not
reviewed by counsel.

## URLs the console asks for

| Field | URL |
|---|---|
| Privacy policy | `https://shantai-mahila-bajar-app-frontend.vercel.app/legal/privacy` |
| Account deletion (Data safety → Data deletion) | `https://shantai-mahila-bajar-app-frontend.vercel.app/delete-account` |
| Terms (optional, store listing) | `https://shantai-mahila-bajar-app-frontend.vercel.app/legal/terms` |

All three are public routes: they open in a browser with no account and no app.

## Data safety form

"Shared" in Play's sense means handed to a third party for *their* use.
Service providers processing on our behalf (Google Cloud/Firebase, Cloudinary,
Vercel, MSG91) do not count, and neither does a transfer the user starts
(a buyer's address reaching the seller she ordered from). So nothing below is
"shared".

| Play category | Data type | Collected | Why (Play's purposes) | Optional? |
|---|---|---|---|---|
| Personal info | Name | Yes | App functionality, Account management | Required |
| Personal info | Phone number | Yes | Account management (OTP), App functionality | Required |
| Personal info | Address | Yes (buyers' delivery addresses; sellers' village, taluka, district, pincode) | App functionality | Required |
| Personal info | Other info | Yes (seller age, education, SHG, business details, FSSAI number, readiness answers) | App functionality, Analytics (programme impact, aggregated) | Mostly optional |
| Personal info | User IDs | Yes (the seller's id and SMB ID, the buyer's customer id) | App functionality, Account management | Required |
| Financial info | User payment info | Yes (seller's UPI ID and QR image) | App functionality | Required for sellers |
| Financial info | Purchase history | Yes (orders) | App functionality | Required |
| Financial info | Other financial info | Yes (UTR numbers, ₹50 payment screenshots) | App functionality, Fraud prevention | Required to pay |
| Photos and videos | Photos | Yes (product photos, QR, payment screenshots, chosen from gallery) | App functionality | Required for sellers |
| App activity | App interactions | Yes (what a seller does on the platform - listings, completed orders, UPI use - measured for her digital readiness score, `shared/src/readiness.ts`) | Analytics (programme impact, aggregated) | Required for sellers |
| App activity | Other user-generated content | Yes (reviews, reports, complaints) | App functionality | Optional (rating is required to reorder) |
| App info and performance | — | No | | |
| Device or other IDs | Device or other IDs | Yes (FCM push token, on the session) | App functionality (notifications) | Optional (permission) |
| Location | — | No (a pincode or address is Personal info, not Location) | | |
| Audio | Voice recordings | No: the mic uses the phone's speech service; the recording goes to Google, never to us | | |
| Contacts, Calendar, Messages, Health, Files, Web history | — | No | | |

Security practices:

- **Data is encrypted in transit:** Yes (HTTPS everywhere).
- **Users can request deletion:** Yes, in the app (My Profile → Delete my
  account) and at the deletion URL above.
- **What is kept after deletion** (disclosed in the privacy policy): past
  orders without the buyer's identity, reviews' stars and words under a
  placeholder name (with the product's name, as long as the order they were
  written on), the ₹50 payment ledger, complaints and reports without contact
  details or shop and product names, a blocked buyer's number (so the block
  holds), and backup copies: the nightly one until the next night, the
  monthly ones for 12 months. The same list is on the `/delete-account` page
  (`del.whatStays`); Play compares the two, so change both.

## Other declarations

- **Developer:** a personal Play account with the developer name **Team Zenith**,
  registered to Sampanna Rajesh Nampalli, publishing for the college. The
  privacy policy's "Who we are" section (`frontend/src/legal/en.ts`, `mr.ts`)
  names both, because Play expects the policy to name the developer on the
  listing. Change one, change the other.
- **Package name:** `in.shantai.mahilabazar`, fixed at the first upload.
- **Reviewer login:** the MSG91 widget's Demo Credentials number, `9579642050`,
  which is sent no SMS. It is exempt from the three-a-day send ceiling
  (`SEND_LIMIT_EXEMPT` in `backend/src/auth/rateLimit.ts`); change both if the
  number changes.
- **Target audience:** 18 and over. Not designed for children.
- **Ads:** None.
- **User-generated content:** Reviews, listings and shop details. In-app
  reporting (`POST /reports`, reasons per target in `shared/src/report.ts`):
  - buyers report a listing (foot of the product page), a review (under each
    review on the product page) and a shop (the seller card, on the product
    and shop pages);
  - sellers report a review (My Reviews) and a buyer (foot of the order
    screen).

  Reports land in the admin console, where admins take listings down, hide
  reviews, block sellers and block a buyer's number. The terms forbid abusive
  content. Shop and buyer reports and the buyer block come from tracks 1.2
  and 1.3; they are true of the live app once `play/server` is deployed.
- **Permissions:** see `docs/DEPLOY.md` §6 *Permissions*. The release APK
  declares no unused ones; `CAMERA` stays declared on purpose.

## Before submitting: things the policy promises that need checking

- **Backups.** The privacy policy and the delete page say deleted
  information leaves the nightly backup the next night and the dated monthly
  copies within 12 months. The code keeps that with nobody in the loop: the
  nightly GitHub run mirrors deletions into Backup Firestore A, removes from
  the backup Cloudinary what the live one has destroyed (`photosToPrune`),
  and stores the dated copies in Backup A's `snapshots` collection, pruning
  each monthly one a week before it turns 12 months old
  (`storedSnapshotsToPrune`; `BACKUP_KEEP_MONTHS` can shorten this, never
  lengthen it). What still depends on people: **the Backup workflow has to
  stay enabled.** GitHub disables a scheduled workflow after 60 days without
  a commit to the repository, and emails a warning first; re-enable it from
  the Actions tab. A `--local` copy on a laptop is pruned only when it is run
  again there, so delete one after the drill it was made for
  (`docs/BACKUP.md`).
- **Rejected ₹50 refunds.** The seller agreement promises the money back
  within 7 working days (`FEE_REFUND_WORKING_DAYS` in
  `frontend/src/legal/operator.ts`). The app does not move money, so this is
  a promise the admin desk keeps by hand.
