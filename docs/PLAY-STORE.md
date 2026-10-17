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
- **The two gaps found on 28 September 2026 are closed.** The in-APK
  deletion text (`del.whatStays.apk`) was brought level with `del.whatStays`
  in `b3df936`. The privacy policy's backup sentence now names all three
  periods (next night, 30 days, 12 months), and `backend/scripts/backup.ts`
  caps `BACKUP_KEEP_DAYS` at 30 as it caps the months at 12, so no
  environment variable can make the sentence untrue.

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

- **Backups.** The privacy policy says deleted information leaves the
  nightly backup the next night, the dated daily copies within 30 days and
  the dated monthly copies within 12 months; the delete page says 12 months.
  The code keeps that with nobody in the loop: the
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
  (`docs/BACKUP.md`). `backend/scripts/backup.ts` caps `BACKUP_KEEP_DAYS` at
  30 and `BACKUP_KEEP_MONTHS` at 12, so the two settings can shorten what
  the policy says and never lengthen it.
- **Rejected ₹50 refunds.** The seller agreement promises the money back
  within 7 working days (`FEE_REFUND_WORKING_DAYS` in
  `frontend/src/legal/operator.ts`). The app does not move money, so this is
  a promise the admin desk keeps by hand.

## Resetting the demo account

Google reviews every update, not only the first release, and each reviewer
signs in with the demo numbers in *Other declarations*. The App access text
asks them to try Delete my account, so the demo is routinely left broken for
the next one — and a reviewer who meets a login that leads nowhere refuses
the update for "test credentials that do not work". **Run this before every
release you send for review**, and whenever a review comes back saying the
login failed.

Everything here is done on the live site and the admin console. The CLI
steps need `API_URL` (the Cloud Run URL), `ADMIN_EMAIL` and `ADMIN_PASSWORD`
set inline, or they talk to `localhost` with a password that does not exist.

### 1. Look

Admin console → Sellers, search "Demo". For each demo number note:

- the shop's **status** (ACTIVE, CLOSED and closing, or gone: an erased shop
  is a CLOSED row with no phone);
- its **subscription end date**;
- its **orders**: is one placed, one accepted, one delivered and rated?

Then sign in on the live site as a buyer with each demo number. If the
rating screen covers the app, or the app asks for a name, the buyer side
needs step 4 or 5.

### 2. A shop closed less than 7 days ago

It is closing, not erased. Either press **Reopen account** on her page in
the console (`POST /admin/sellers/:id/restore`), or sign in as the demo
seller and tap **Reopen my account** on My Business. Nothing was erased:
products, slots and the end date are as they were, and the shop is back in
the demo buyer's catalogue at once. Go to step 4.

### 3. A shop already erased

Closing was more than 7 days ago, `sweepClosedAccounts()` has run, and her
number is free again. Build the shop afresh:

1. On the live site, "I want to sell", sign in with the demo number, and
   register. Shop name **Demo shop (Play review)**. For the village choose
   **Another village** and type **Demo**, so the shop's SMB ID is
   `SMB-DEMO-NN` and does not take a serial in a real woman's village. Any
   Maharashtra pincode (for example `413603`).
2. For the UPI ID use one the team controls — a reviewer may scan the QR,
   and a stranger's ID would be paid. Never a seller's.
3. Grant one pack: **Grant slots** on her page in the console, or
   `npm run admin -- grant <demo phone> 1`. This makes her ACTIVE and,
   because the new row has no term, starts six months from today.
4. Add 2–3 products with photos (keep the photos in a folder so the next
   reset does not have to find them again). They go to the queue.
5. Approve them: Products → Pending in the console, or
   `npm run admin -- products` then `approve-product <id>`.

### 4. The buyer

- **She closed her account:** that erases a buyer at once, and signing in
  again makes a new, empty one. Sign in as a buyer with the demo number,
  give a name and tick the consent box.
- **The rating screen is up:** rate the delivered order. An unrated
  delivered order inside 30 days locks the whole buyer app, and the
  reviewer has no idea why.

### 5. The orders a reviewer expects

The App access text promises one order to accept, one to pack and one to
confirm a UPI payment on. From the demo buyer, ordering from the demo shop:

- **Placed:** one order, cash on delivery, left alone. (A reviewer who
  closes an account cancels it first, because an open order refuses the
  close — so it is always the one that needs replacing.)
- **Accepted, UPI:** one order paid by UPI. As the seller, accept it (skip
  the delivery-time question). As the buyer, enter a 12-digit UTR. **Every
  reset needs a new UTR**: the same number is refused on a second order.
- **Delivered and rated:** one cash order. As the seller accept, pack, send
  and mark delivered; as the buyer rate it, or the buyer app locks.

### 6. The shop's term

A granted pack never extends a term, so the demo shop goes off the shelf
six months after it was set up. In its last 7 days, **Record payment** on
her page in the console, For: Renewal, Paid by: Other, note "Demo account
for Play review — no money received". It moves the date six months. It also
adds ₹50 to the dashboard's subscription revenue, so subtract the demo
renewals when that figure is reported. Set a calendar reminder for the week
before the date shown on her page.

### 7. Check it as a reviewer would

Sign out everywhere. With **each** demo number, sign in as a buyer and see
the demo shop and its products; sign in as a seller and see the three
orders. If either number fails at the OTP, check its Demo Credential in
MSG91 before anything else — no SMS is sent to these numbers, so a missing
credential looks like a code that never arrives.
