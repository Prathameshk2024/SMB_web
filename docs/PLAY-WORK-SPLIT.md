# Play Store work: two tracks

27 September 2026. The tasks from `docs/PLAY-READINESS-REVIEW.md` (the review), split so two people can work at the same time. The review has the evidence and file:line for every item; this file only says who does what, and in what order.

**Status, 28 September 2026** (checked against `prathamesh2` at `9e91006`): both tracks are merged (`969062c`, `5fd8861`) and pushed. Every task that lives in this repo is done except 1.7's production scrub, which is not verifiable here, and 2.12, which is waiting on the college. 2.1 and 2.11 live in the wrapper repo and are not verifiable from this one. The last column of each table says which.

**The split is by files, not by topic.** Track 1 owns the server; Track 2 owns the screens, the policy wording and the Android wrapper. Two people editing the same file on different branches is where merges go wrong, so each file has one owner:

| Files | Owner |
| --- | --- |
| `backend/`, `admin/`, `shared/` | Track 1 |
| `frontend/` (screens, `i18n/strings.ts`, `legal/en.ts`, `legal/mr.ts`), `docs/PLAY-STORE.md`, `docs/DEPLOY.md` | Track 2 |
| The Android wrapper repo (`SMB_Android_App/Android_app`) | Track 2 |
| `CLAUDE.md` | Both. Edit only the section about your own change. |

When your change needs words in a file the other track owns (the policy, a screen label), **send the other person the facts, and they write the words.** Every Marathi string follows `docs/MARATHI-STYLE.md`, whoever writes it.

## Before splitting: together (30 minutes)

- [x] **This repo:** the demo-number send-limit exemption, the privacy policy's developer name and the docs, committed and pushed to `prathamesh2` on 27 September. The policy's "published on Google Play under Team Zenith" sentence went live with it, a little ahead of publication.
- [x] **Wrapper repo:** the package rename and both `google-services.json` files, committed and pushed to `sub-main`. Nothing deploys from that repo.
- [x] Track 1: `play/server` created from `prathamesh2` and pushed on 27 September. Track 2: `play/app` still to create. *Both exist on `origin` now.*
- [x] **Do not push to `prathamesh2` until the joint steps at the end.** Both Vercel projects deploy from it, so a push there is a live release to real sellers and buyers. Pushing a `play/*` branch is fine; Vercel only makes a preview of it. *Held until the merge on 27 September; `prathamesh2` has been pushed since, with further commits on 28 September.*

## Track 1: server, data and admin console

Owner: ____________

| # | Task | Review item | Size | Status, 28 September 2026 |
| --- | --- | --- | --- | --- |
| 1.1 | **Do this first, day 1:** add `seller` and `customer` to `REPORT_TARGETS` in `shared/src/report.ts`, with their reasons, and push the branch. Track 2's report buttons are built on this. | B3 | 30 min | Done (`ceb5588`). |
| 1.2 | Accept reports on shops and buyers in `POST /reports`. Show them in the admin console (reported shops, reported buyers). | B3 | 2–3 h | Done (`3951617`, `bdb789a`). |
| 1.3 | Block a buyer: an admin route and a console button, keyed on the phone, so she cannot sign in or order again with the same number. Tests. | B3 | 2–3 h | Done: `POST /admin/customers/block`, `block-buyer.test.ts`. |
| 1.4 | Demo safeguards: hide the demo shop from the public catalogue except for the demo number's own buyer session (`catalog.routes.ts:28`), and refuse orders from the demo buyer to real sellers (`orders.routes.ts:141`). Tests. | B1 | 1–2 h | Done (`6fc4c27`, `demo-guard.test.ts`). |
| 1.5 | A deleted buyer's orders must not come back: in `closeCustomer`, replace `customerId` on her orders, reviews and reports with a random tombstone id. Test that her digits appear nowhere afterwards. | B4 | 1–2 h | Done (`6946caa`, `account-erasure.test.ts`). |
| 1.6 | Finish erasing a closed account:<br>• her products and their photos (remove or tombstone, respecting `isBulkDelete`)<br>• complaints: name, phone, `byUserId`<br>• `order.landmark`, `seller.fssai`, `seller.shopSlug`, `closeNote`<br>• add all of them to `SELLER_PII_FIELDS`<br>**Tell Track 2** whether listings are removed or kept, and that review text stays. | Privacy table | 2–3 h | Done (`6946caa`, `d523457`). |
| 1.7 | Run `pruneAuthEvents` on the 15-minute housekeeping timer. Write a one-off script that hashes or deletes the raw IPs in old `authEvents` rows with `detail: 'account.close'`. | Privacy table | 1 h | Partly: timer and `npm run scrub:auth-ips` done (`822bf5f`); running the scrub on production is not verifiable from this repo. |
| 1.8 | Backups: prune the monthly database files (for example, after 12 months) and remove photos from the backup Cloudinary that the live one no longer has. **Tell Track 2** the real retention period. | Privacy table | 2 h | Done (`5081f68`), and since moved into the backup project with a read-back check (`e067987`, `9d287c2`). |
| 1.9 | Shop details: accept `photo` and `upiQrUrl` only from this Cloudinary account's folders, as `screenshotProblem()` does. | Should fix | 1 h | Done (`822bf5f`, `ownImageProblem()`). |
| 1.10 | Categories: check `categoryId` against `CATEGORIES` on the server. Rename "सौंदर्य व आरोग्य / Beauty & Wellness" to Beauty & Personal care in `backend/src/db/seed.ts`. | Should fix | 1 h | Done (`822bf5f`). |
| 1.11 | Refuse to start in production when `SEED_DEMO_DATA` is set. | Minor | 15 min | Done (`822bf5f`). |
| 1.12 | Give the roughly 16 backend errors that lack one a `messageMr`. | Minor | 1–2 h | Done (`822bf5f`, 19 errors). |

About 2 working days. Run `npm test` and `npm run typecheck` before handing over.

## Track 2: screens, policy text and Android

Owner: ____________

| # | Task | Review item | Size | Status, 28 September 2026 |
| --- | --- | --- | --- | --- |
| 2.1 | **Upload keystore:** create it with the `keytool` command in the wrapper's README, put the four `SMB_UPLOAD_*` values in `~/.gradle/gradle.properties`, and back up the `.jks` and passwords somewhere other than this machine. Whoever will build the .aab should hold it. | Before first upload | 20 min | Not verifiable from this repo. |
| 2.2 | The deletion page names the app: a heading with "Shantai Mahila Bazar" and the college (`screens/landing/DeleteAccount.tsx`). | B5 | 30 min | Done (`f18b020`). |
| 2.3 | Report buttons, **after Track 1 has pushed 1.1**:<br>• buyers can report reviews on the product page (`reportable` in `Browse.tsx:396`)<br>• "Report this shop" on the shop page and the seller card<br>• sellers can report a buyer from the order screen | B3 | 2–3 h | Done. |
| 2.4 | Buyers get a Help / contact card in My Profile, as sellers have. | Should fix | 30 min | Done (`27be020`). |
| 2.5 | Fix the misleading strings: `lp.w4b`, `lp.wl3`, `wait.canDoMeanwhile`, `wait.title`, `lp.w1b`. Correct the seller agreement's FSSAI sentence. Leave `lp.wl4` for the ₹50 step. | Should fix | 1 h | Done (`29c2a8d`). |
| 2.6 | Policy text, both languages:<br>• hosting logs and their retention<br>• GitHub as a service provider<br>• "review text stays"<br>• what happens to a closed seller's listings (from 1.6)<br>• the backup period (from 1.8), also on the deletion page<br>• no health or cure claims, no supplements or ayurvedic medicines, in the terms | Privacy table, Should fix | 2–3 h | Done (`b5bfc3c`, `a266c4b`, `6b21fa5`). Two gaps found 28 September: the backup sentence omits the 30 days of dated nightly copies, and `del.whatStays.apk` (the deletion page inside the APK) lists only orders and fees. |
| 2.7 | Add "and I am 18 or older" to both consent tick-boxes (seller registration and the buyer's name screen). | Privacy table | 30 min | Done (`4b5ae81`), and on the `PolicyGate` button (`9e91006`). |
| 2.8 | **Once 2.6 and 2.7 are finished,** move `POLICY_VERSION` once, because what people agree to has changed (age, health claims). Doing it once means everyone is asked again only once. | — | 10 min | Done: `2026-09-27` (`048bcaa`). `9e91006` changed only the gate button afterwards, which needs no new version. |
| 2.9 | `docs/PLAY-STORE.md`:<br>• add User IDs and App interactions (Analytics) to the Data safety table<br>• correct the "Report on every listing and review" claim once 2.3 is done<br>`docs/DEPLOY.md:471-473`: the permission table still lists location permissions the APK no longer has. | Privacy table | 45 min | Done (`74a1e81`); PLAY-STORE.md re-checked against the code on 28 September. |
| 2.10 | Minor screens:<br>• "Network error" through `t()` on the 10 screens listed in the review<br>• `ConfirmSheet` instead of `confirm()` in `CartCheckout.tsx:1036`<br>• add `/college.jpg` or remove the image<br>• a QR code with no amount in `PaymentQr.tsx:140` | Minor | 2 h | Done. |
| 2.11 | Android wrapper (separate repo):<br>• `mixedContentMode="never"`<br>• links to other sites open in the browser<br>• `allowBackup="false"`<br>• `uses-feature` camera and microphone `required="false"`<br>• no `console.log` in release builds<br>• brand-colour spinner<br>This needs a new APK, so it must be finished before the .aab is built. | Should fix | 1–2 h | Not verifiable from this repo. |
| 2.12 | Contact details: ask the college for an official email and desk number to replace the personal ones in `legal/operator.ts`. This is a request to the college, not code, so start it early. | Should fix | Waiting time | Partly: the college office (`9420488874`, `principal.jascca@gmail.com`) now takes everyday help and deletions (`6ce1add`); the grievance officer is still a personal mobile and Gmail. |

About 2 working days, plus the wait for the college in 2.12. Run `npm test` in `frontend/` before handing over. The Marathi tests check the style sheet's mechanical rules.

## Where the tracks meet

| When | Who | What |
| --- | --- | --- |
| Day 1, first hour | Track 1 → Track 2 | 1.1 pushed, so the report buttons (2.3) can be built |
| After 1.6 | Track 1 → Track 2 | Listings removed or kept, and "review text stays", for the policy (2.6) |
| After 1.8 | Track 1 → Track 2 | The real backup retention period, for the policy and deletion page (2.6) |
| After 2.3 | Track 2 | Correct the reporting claim in PLAY-STORE.md (2.9) |

Everything else is independent.

### Track 1 → Track 2: the facts, as built (27 September, branch `play/server`)

All twelve Track 1 tasks are on `play/server`. What Track 2 needs from them:

**Reports (for 2.3).** `POST /reports` takes `targetType` of `product`, `review`, `seller` or `customer`, with `targetId`, `reason`, `note` (only for `other`) and, for a buyer, an optional `orderId`. The reasons per target are `reasonsFor(target)` in `shared/src/report.ts`; `REPORT_REASONS` still means the product list, so `ReportSheet` should switch to `reasonsFor(targetType)` and `reportProblems(input, targetType)`. New reason codes needing `report.reason.*` strings in `frontend/src/i18n/strings.ts`, both languages: `noDelivery` (shop took money, sent nothing), `abusive`, `noShow` (ordered, never took delivery), `falsePayment` (said they paid, no money came). The admin console's wording for them is in `admin/src/i18n/strings.ts` if you want to match it. A seller reports a buyer with `targetId: order.customerId` and `orderId: order.id`; the server refuses (404) unless an order exists between them. A buyer reports a shop with `targetId: seller.id`. `mayReport(role, target)` says who may report what, so a seller's screen must not offer "report this listing".

**Blocked buyers.** A blocked number gets `403 { error: 'Blocked', messageMr }` from `/auth/otp/verify` after the OTP passes, and the same from `POST /orders`. The OTP screen should show `messageMr` rather than the generic "wrong code" line for a 403.

**Deletion (for 2.6 and the deletion page).**
- A closed seller's **listings are removed**: each is emptied (name, photo, ingredients, material, FSSAI number) the moment the 7-day window ends, and the photo is destroyed; the empty row disappears from the database shortly after.
- **Review text stays**, with the stars, under the `ग्राहक` placeholder name. This was already true and is now in the shared rule.
- A closed buyer's **id is replaced by a random tombstone** on her orders, reviews, reports and complaints, so signing in again with the same number gives a new, empty account. Her complaint to the desk keeps its words and loses her name and phone.
- A **blocked** buyer's phone number is kept after deletion, so the block holds. The policy should say a number blocked for misuse is retained for that purpose.
- **Backups:** deleted data leaves the nightly mirror and the backup photos on the night after deletion, and the dated database files within **12 months**. That is the sentence for the policy and the deletion page.
- The security log (auth events) is now pruned on the clock, so "90 days" is true.

**Demo account.** The demo shop is invisible to everyone but the demo buyer, and orders between demo and real accounts are refused on the server with a Marathi message (`demoOrderProblem` in `backend/src/demo.ts`). Nothing in the app needs to change for it.

**Categories.** `beauty` is now "Beauty & Personal care" / "सौंदर्य व निगा" from the API; `categoryPhoto.ts` keys on the id and is unaffected.

## Together, at the end

- [x] Merge `play/server` and `play/app` into `prathamesh2`. Run `npm test` and `npm run typecheck` from the root. *Merged in `5fd8861` on 27 September. Tests were not re-run for this status check.*
- [ ] Deploy the API to Cloud Run **when nobody is ordering**, then push `prathamesh2` so Vercel deploys the frontend and admin console. *Partly: `prathamesh2` is pushed. The Cloud Run revision is not verifiable from this repo; if it is older than the merge, the frontend's shop and buyer reports are refused.*
- [x] Move the demo login to `9999999999`, the number now set in MSG91's Demo Credentials: `DEMO_PHONE`, its tests and the docs. The OTP stays out of this repo. *Done (`86e89e6`) on 28 September; the API deploy that carries it is still to do.*
- [x] Keep `9579642050` as a demo number beside `9999999999`, which a check outside this repo refuses: `DEMO_PHONES` in `backend/src/demo.ts` holds both, one demo world. *Done on 28 September; the API deploy that carries it is still to do.*
- [ ] Re-test both demo logins (`9579642050`, `9999999999`) on the live site, after the API deploy that carries `DEMO_PHONES`. *Not verifiable from this repo.*
- [ ] Prepare the demo data: the review's *App access → Production data to prepare* checklist. *Not verifiable from this repo. The reset runbook it asks for is not in `docs/PLAY-STORE.md` yet.*
- [ ] Fill in Play Console → App access from the review's draft text, and the Data safety form from `docs/PLAY-STORE.md`. *Not verifiable from this repo. PLAY-STORE.md was re-checked against the code on 28 September; fix the two text gaps it lists first.*
- [x] **The ₹50 fee:** decide between options A, B and C, then build it. See the review's last section. Under option A this touches both tracks' files, so one person does it, or you split it the same way: server (Track 1) and screens (Track 2). *Option A, built in `77110fa`.*
- [ ] Build the .aab with the upload keystore, upload it to closed testing, and start the 12-tester, 14-day test. *Not verifiable from this repo.*

**Uploads to closed testing are reviewed too.** A build that still shows the in-app ₹50 payment could be flagged at that first review. If you want the 14-day clock started before the ₹50 step, accept that risk; otherwise do the ₹50 step before the first upload. *No longer a risk once the frontend with `77110fa` is live: the APK loads the website.*
