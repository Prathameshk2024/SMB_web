# Google Play submission: the policy answers

What the Play Console asks about data and policies, answered from what the
code does. The privacy policy (`frontend/src/legal/`) says the same things in
words a user reads; if one changes, change the other.

**Have a lawyer read the policies before the first public release.** They
were written to match the code and Indian law as of September 2026, not
reviewed by counsel.

Last checked against the code on 28 September 2026 (`prathamesh2` at
`9e91006`): the routes in `frontend/src/App.tsx`, the privacy policy in
`frontend/src/legal/en.ts`, the erasure lists in `shared/src/accountClose.ts`,
`backend/src/db/accountClose.ts` and `publicSeller()`. The wrapper's manifest
is in another repository and was not re-checked here.

## URLs the console asks for

| Field | URL |
|---|---|
| Privacy policy | `https://shantai-mahila-bajar-app-frontend.vercel.app/legal/privacy` |
| Account deletion (Data safety → Data deletion) | `https://shantai-mahila-bajar-app-frontend.vercel.app/delete-account` |
| Terms (optional, store listing) | `https://shantai-mahila-bajar-app-frontend.vercel.app/legal/terms` |

All three are public routes: they open in a browser with no account and no app.
`/delete-account` and `/legal/:docId` sit outside every `Require` in
`App.tsx`; the document ids are `privacy`, `terms`, `seller`, `refunds` and
`grievance`. The deletion page names the app ("Shantai Mahila Bazar") and
the college in its first card, as Play requires, and the landing footer
links to it.

## Data safety form

"Shared" in Play's sense means handed to a third party for *their* use.
Service providers processing on our behalf (Google Cloud/Firebase, Cloudinary,
Vercel, MSG91) do not count, and neither does a transfer the user starts
(a buyer's address reaching the seller she ordered from). So nothing below is
"shared".

| Play category | Data type | Collected | Why (Play's purposes) | Optional? |
|---|---|---|---|---|
| Personal info | Name | Yes | App functionality, Account management | Required |
| Personal info | Phone number | Yes (the sign-in number; a seller's WhatsApp number) | Account management (OTP), App functionality | Required |
| Personal info | Address | Yes (buyers' delivery addresses; sellers' village, taluka, district, pincode) | App functionality | Required |
| Personal info | Other info | Yes (seller age, education, SHG, business details, FSSAI number, readiness answers) | App functionality, Analytics (programme impact, aggregated) | Mostly optional |
| Personal info | User IDs | Yes (the seller's id and SMB ID, the buyer's customer id) | App functionality, Account management | Required |
| Financial info | User payment info | Yes (seller's UPI ID and QR image) | App functionality | Required for sellers |
| Financial info | Purchase history | Yes (orders) | App functionality | Required |
| Financial info | Other financial info | Yes (UTR numbers; ₹50 payment screenshots, see the note below) | App functionality, Fraud prevention | Required to pay |
| Photos and videos | Photos | Yes (product photos, the bank QR, ₹50 payment screenshots, chosen from gallery) | App functionality | Required for sellers |
| App activity | App interactions | Yes (what a seller does on the platform - listings, completed orders, UPI use - measured for her digital readiness score, `shared/src/readiness.ts`) | Analytics (programme impact, aggregated) | Required for sellers |
| App activity | Other user-generated content | Yes (reviews, reports, complaints) | App functionality | Optional (rating is required to reorder) |
| App info and performance | — | No | | |
| Device or other IDs | Device or other IDs | Yes (FCM push token, on the session) | App functionality (notifications) | Optional (permission) |
| Location | — | No (a pincode or address is Personal info, not Location) | | |
| Audio | Voice recordings | No: the mic uses the phone's speech service; the recording goes to Google, never to us | | |
| Contacts, Calendar, Messages, Health, Files, Web history | — | No | | |

**The ₹50 rows, since 27 September 2026 (`77110fa`).** Inside the APK the
seller's pay screen is gone (`lib/inApk.ts`, `ShopRegistration`), so the app
itself no longer takes a ₹50 screenshot or UTR; the website still does, and
staff may type an optional UTR with Record payment. They stay declared: the
privacy policy covers the website and the app together and still lists them
(`en.ts`, "For each ₹50 payment"), and the two must agree. A buyer's UTR is
still collected in the app either way. `payerUpi` on a payment row is filled
from her own UPI ID (`sellers.routes.ts`, `submitPayment`; the app sends
none), so it adds nothing beyond the User payment info row.

Checked and not collected: no seller profile photo is uploaded from any
screen (the only `PhotoPicker`s are product, bank QR and ₹50 screenshot); the
sign-in record keeps the browser's user-agent string and the security log a
hashed IP, neither of which is a Play data type as used here.

Security practices:

- **Data is encrypted in transit:** Yes (HTTPS everywhere).
- **Users can request deletion:** Yes, in the app (My Profile → Delete my
  account; in Marathi माझी माहिती → माझे खाते कायमचे बंद करा, `close.open`) and at
  the deletion URL above. Staff can also close an account for somebody who
  cannot sign in (`POST /admin/sellers/:id/close`, `/admin/customers/close`).
- **What is kept after deletion** (disclosed in the privacy policy): past
  orders without the buyer's identity, reviews' stars and words under a
  placeholder name (with the product's name, as long as the order they were
  written on), the ₹50 payment ledger (amount, date, UTR; `PAYMENT_PII_FIELDS`
  empties the phone, `payerUpi` and screenshot), complaints and reports
  without contact details or shop and product names, a blocked buyer's number
  (so the block holds), and backup copies: the nightly mirror until the next
  night, the dated nightly copies for 30 days (`BACKUP_KEEP_DAYS`), the
  monthly ones for 12 months. The same list is on the `/delete-account` page
  (`del.whatStays`); Play compares the two, so change both.
- **Two gaps in that agreement, found 28 September 2026:**
  - Inside the APK the deletion page reads `del.whatStays.apk`, a twin made
    in `77110fa` to drop the ₹50, and it was not updated by `6b21fa5`. It
    names only orders and fees: no reviews, complaints, blocked number or
    backups. The URL Play opens is a browser and gets the full text, but a
    user in the app reads less than the policy says. Bring the twin level
    with `del.whatStays`, minus the price.
  - The privacy policy's backup sentence names the nightly mirror and the
    monthly copies but not the 30 days of dated nightly copies. It is not
    false (all are gone within 12 months, which is what the deletion page
    says), but "the dated copies within 12 months" would be exact.

## Other declarations

- **Developer:** a personal Play account with the developer name **Team Zenith**,
  registered to Sampanna Rajesh Nampalli, publishing for the college. The
  privacy policy's "Who we are" section (`frontend/src/legal/en.ts`, `mr.ts`)
  names both, because Play expects the policy to name the developer on the
  listing. Change one, change the other.
- **Package name:** `in.shantai.mahilabazar`, fixed at the first upload.
- **Reviewer login:** +91 `9579642050` or +91 `9999999999` — both the MSG91
  widget's Demo Credentials, so no SMS is sent. They are `DEMO_PHONES` in
  `backend/src/demo.ts`, which keeps the demo shops apart from real ones and
  exempts them from the three-a-day send ceiling (`SEND_LIMIT_EXEMPT` in
  `backend/src/auth/rateLimit.ts`); change them there and in MSG91 together.
  The App access text is in `docs/PLAY-READINESS-REVIEW.md`.
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
  content. Checked in the code on 28 September 2026: `REPORT_TARGETS` is
  all four, the report links are on `ReviewList reportable` and `SellerCard`
  (`screens/customer/Browse.tsx`), the seller's order screen and
  `/seller/reviews`. Shop and buyer reports and the buyer block came from
  `play/server`, merged into `prathamesh2` (`5fd8861`) and pushed, so Vercel
  has the screens; whether the API on Cloud Run has been redeployed since is
  not verifiable from this repo, and until it is an older API refuses the
  new report targets and has no block route.
- **Payments:** buyers pay sellers by UPI for physical goods, outside Play
  Billing, which the policy exempts. The ₹50 seller fee has no price, QR or
  pay form inside the APK (option A, `77110fa`); staff record it with Record
  payment. The Terms and Seller Agreement readable in the app still describe
  the ₹50 and say it is paid to the college (`legal/en.ts`, `seller.fee`):
  a judgement call recorded in the readiness review.
- **Permissions:** see `docs/DEPLOY.md` §6 *Permissions*: `INTERNET`,
  `RECORD_AUDIO` (voice typing), `CAMERA` (declared, never requested, which
  keeps the picker to the gallery), `POST_NOTIFICATIONS` and `VIBRATE`, plus
  normal-level ones merged in by libraries. No location, storage, SMS or
  contacts, so nothing on the permissions declaration form. That table was
  taken from the release APK built on 26 September 2026 in the wrapper repo;
  confirm it on the APK actually uploaded with `aapt dump permissions`.

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
  (`docs/BACKUP.md`). And leave `BACKUP_KEEP_DAYS` alone: `backend/scripts/backup.ts`
  caps `BACKUP_KEEP_MONTHS` at 12 but not the days, so a value over about
  365 would keep dated nightly copies past the 12 months the policy promises.
- **Rejected ₹50 refunds.** The seller agreement promises the money back
  within 7 working days (`FEE_REFUND_WORKING_DAYS` in
  `frontend/src/legal/operator.ts`). The app does not move money, so this is
  a promise the admin desk keeps by hand.
