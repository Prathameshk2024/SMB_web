# Future scope

Work that has been decided on but deliberately left for later. Each item says
why it matters and what "done" looks like, so whoever picks it up does not
have to rediscover either. Delete an item when it is done — git keeps the
history.

## Known bugs

*Added 28 September 2026*, from an audit that checked every item against the
code at `03bd22a`; none of these was fixed at that point. The manual test plan
carries the same bugs as "Known bug/gap, 2026-09-28" notes on the rows that
would catch them — clear the note there too when one is fixed. Worst first.

### Harm to a person or to the Play listing

- **An order's quantity is never checked against stock.** `POST /orders`
  (`orders.routes.ts`, the `g.items.map`) takes `qty: Math.max(1, Number(i.qty))`
  and only checks that the product is LIVE. A direct API call can order 999
  jars from a shelf of five, or any amount of a made-to-order item (the cap of
  20 exists only in the cart). A non-numeric qty gives `NaN` and a total of
  `NaN`; `1.5` is accepted. Nothing decrements stock either. *Fix:* integer
  1…`stock` (or 1…20 for made-to-order), else 400 with a Marathi message.
- **Blocking a seller in her closing week means she is never erased.**
  `POST /admin/sellers/:id/block` sets `BLOCKED` without looking at `CLOSED`,
  and `sweepClosedAccounts()` only erases `CLOSED` rows — so the deletion
  promised on `/delete-account` and in the Play data safety form never
  happens. Unblocking then sets her `ACTIVE`, reopening a shop she asked to
  close. The console's Block button stays live through the week
  (`SellerActions.tsx`). *Fix:* refuse block/unblock on a `CLOSED` seller
  (409), or let the block ride alongside the close without replacing it.
- **A false "mark packed" task.** `needsSellerAction()` in `orderFlow.ts`
  counts every ACCEPTED order, including a UPI one still waiting for the
  buyer's money (`awaitingCustomerPayment`). My Business lists it as "mark
  packed", which the server and the Orders screen both forbid. *Fix:* leave it
  out of `needsSellerAction` while the buyer owes the payment.
- **The edit screen lets her change fields she has no edits left for.** In
  `EditProduct.tsx` the veg/non-veg and made-to-order `Choice`s have no
  `disabled`, though both are in `EDIT_COUNTED_FIELDS`; every other counted
  field is locked. Save then fails with 409 and any price or stock change in
  the same save is lost. *Fix:* disable them like the rest.

### Wrong or missing on the console

- **Paused listings cannot be moderated.** Admin Products has only
  PENDING / LIVE / REPORTED tabs, and `ProductCard` shows actions only for
  pending or live, so a PAUSED listing — reported or not — can be neither found
  there nor taken down (her page lists it, with no button). Separately,
  `POST /admin/products/:id/moderate` has no status gate, so approving a
  PAUSED listing would make it LIVE.
- **Raw keys and statuses on screen.** Complaints print `help.subject.*`
  (the key is missing from `admin/src/i18n/strings.ts`); order and payment
  statuses print as `OUT_FOR_DELIVERY`, `APPROVED` etc. in `Orders.tsx`,
  `SellerDetail.tsx` and `components/CloseAccount.tsx`, in both languages.
- **"Free" delivery for a charge nobody set.** `SellerDetail.tsx` shows
  `sd.freeDelivery` when `deliveryFee` is 0; the rule is that 0 means "ask the
  seller" (CLAUDE.md, *One seller per cart*).
- **The Reported tab's count is wrong.** `reportedCount` in
  `admin.routes.ts` counts open reports of every target type, so the badge can
  show a number while the tab is empty. Filter on `targetType === 'product'`.
- **`npm run admin -- pending` prints "waiting 0h" on every row.** It reads
  `waitingHours`, which `/admin/payments` stopped sending on purpose; compute it
  from `submittedAt` as the console's `waited()` does.
- **The admin CLI falls back to `admin@shantabazar.in` / `changeme`**
  (`backend/scripts/admin.ts`). It cannot sign in — no admin is seeded and
  passwords need 12 characters — but it contradicts "no default admin
  password". Remove the fallback and ask.
- **Dead dashboard fields.** `openDisputes` is a fixed 0; `gmvMonth` (a
  duplicate of `womenEarnedMonth`) and `repurchaseRate` are computed and never
  shown.

### Wrong or missing in the seller and buyer app

- **A buyer's reason for closing her account is thrown away.** The sheet
  makes her pick one; `api.closeCustomerAccount` sends only `{ confirm }` and
  `POST /customers/me/close` reads nothing else. Send and store it as the
  seller path does.
- **"Not verified" can never go away.** `upiVerified` is set true only in
  seed data; registration, a UPI change and a close all set it false, and no
  admin route or CLI sets it true. Every real seller sees a permanent warning
  on her payment QR and profile, and the readiness factor
  `hasDigitalFinance` (`readiness.ts`) can never be earned, biasing the
  before/after index down. *Decide:* add a way for staff to verify, or remove
  the pill and the factor.
- **"How many people saw" on My Growth is always 0.** Nothing increments
  `product.views`; `POST /catalog/share/:slug/scan` has no caller and does not
  `save()` its count.
- **A shop with no live listings shows no seller card.** `SellerShop` in
  `Browse.tsx` takes the seller from `products[0]`; fetch it from
  `GET /sellers/:id` instead.
- **The checkout's UPI option says "Pay now"** (`cus.payUpi`) while the notice
  under it says she pays after the seller accepts.
- **The seller door's sheet is titled "Selling section" in both directions**
  (`lp.switchTitle` in `Landing.tsx`); the body switches, the title does not.
- **Icon-only buttons.** The pause/play button on a My Products row and the
  shop open/close toggle on My Business have no word and no `aria-label`,
  against "every icon carries a word".
- **Small tap targets.** The landing page's language buttons are 34px tall
  with ~12px text (`.langswitch button`); `.appbar__btn` drops to 40px under
  400px wide. The rule is 44px targets and 16px text.
- **The FAQ has questions and no answers** (`help.faq1-3` in `Misc.tsx`), and
  "Watch training" on the waiting screen promises videos that do not exist
  (it opens the walkthrough tours).
- **Pausing or unpausing a listing fails silently** — `togglePause` in
  `MyProducts.tsx` has no `catch`.
- **Some refusals are shown in Marathi on the English app.** Upload and edit
  print the server's `messageMr` for 403 "Not active" and 409 "No edits left"
  instead of a dictionary line. (The 402 and expired-403 are already mapped,
  in `submitError.ts` — which has no test; one would keep the ₹50 out of the
  APK for good.)
- **Admin seller search misses a formatted number.** `Sellers.tsx` matches
  the search text against the stored phone as a substring, so
  "+91 98220 11223" finds nothing; run it through `normalizePhone` first.

### Development only

- **After a failed Firestore connection the boot banner still says
  Firestore.** `describeConfig()` and the push wiring read the config constant
  `usingFirestore`, not the runtime `firestoreLive` in `store.ts`. The banner
  line for Cloudinary off also still says "emoji only", which is no longer
  true.

## Give the backup a read-only Firebase key

*Added 25 September 2026.*

The nightly backup (`.github/workflows/backup.yml`) reads the live Firestore
with `LIVE_FIREBASE_SERVICE_ACCOUNT`, which is the same full-access key Cloud
Run uses. The backup never writes to the live project — it reads a fixed list
of collections by name — so a leaked Actions secret should be able to read
the database at most, not change or delete it.

1. In the Google Cloud Console, on the **live** project: IAM & Admin →
   Service Accounts → create `backup-reader` with exactly one role,
   **Cloud Datastore Viewer** (`roles/datastore.viewer`).

   ```bash
   gcloud iam service-accounts create backup-reader --project=LIVE_PROJECT_ID
   gcloud projects add-iam-policy-binding LIVE_PROJECT_ID \
     --member="serviceAccount:backup-reader@LIVE_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/datastore.viewer"
   ```

2. Keys → Add key → JSON. Keep the file out of the repository.
3. GitHub → Settings → Secrets and variables → Actions → replace
   `LIVE_FIREBASE_SERVICE_ACCOUNT` with the file's contents (raw JSON or
   base64 JSON; `config.ts` reads either). Then delete the local file.
4. Actions → Backup → Run workflow with **dry_run** ticked. It should print
   `firestore read N documents` with the usual N; `PERMISSION_DENIED` means
   the role went on the wrong project. Then one real run.

**Do not delete the old key** — it is Cloud Run's, in Secret Manager.

Done also means:

- The note in `docs/BACKUP.md` that says the backup uses Cloud Run's key is
  rewritten to describe the read-only account.
- Decide whether to rotate Cloud Run's key: it sat in GitHub and was handed
  to Actions runners until now. Rotating is new key → new Secret Manager
  version → redeploy → delete the old key.
- `LIVE_CLOUDINARY_API_KEY` / `_SECRET` in the same workflow are also the
  live account's full keys. If the Cloudinary plan allows a key with
  restricted permissions, the same reasoning applies.

## Move the photos to a new Cloudinary account

*Added 28 September 2026, from `docs/BACKUP.md`.*

Every photo URL stored in Firestore names the live Cloudinary account, so if
that account is lost, closed or locked, restoring the photos into another one
brings back files the app cannot show. Until a script rewrites the stored
URLs, the only defence is keeping the live account alive, with its login
known to more than one person.

`docs/BACKUP.md` §4, *Not built: moving the photos to a new Cloudinary
account*, is the whole specification — which fields hold URLs, replacing the
prefix only, a dry run by default, switching Cloud Run's Cloudinary settings
at the same time, and retiring the backup account as a target. Done means
that section is replaced by the command, and a restore drill has used it.

## Delivery charge by distance, set by the seller

*Added 25 September 2026.*

A seller has one flat `deliveryFee` (and `freeDeliveryAbove`), and no screen
asks her for either — so almost every order carries 0, which the cart shows
as "ask the seller" (see *One seller per cart* in `CLAUDE.md`). The buyer
learns the real charge only on a phone call after ordering.

Give the seller the option of charges by distance: for example ₹20 up to
5 km, ₹40 up to 10 km, ₹60 up to 20 km — bands she chooses. The checkout
then works out the charge for the buyer's address and shows

> **total = item price + delivery charge**

before the order is placed, and the order stores that figure in
`deliveryFee` / `total` exactly as today (`orders.routes.ts`, where the fee is
chosen now).

To settle before building it:

- **Where the distance comes from.** Nothing in the app has a location today —
  only pincodes. The cheapest honest answer is the distance between the
  centres of the seller's and the buyer's pincodes, from a bundled
  Maharashtra pincode table; asking for GPS adds a permission prompt and a
  wrong-location problem. Say on screen that the figure is approximate.
- **It stays optional.** A seller who sets no bands keeps today's behaviour,
  and 0 still means "ask the seller", never "free".
- **Beyond her last band.** Her pincode list is a hint, not a gate (*Where an
  order may go*), so an address past the last band should fall back to "ask
  the seller" rather than refuse the order.
- **`freeDeliveryAbove` still wins** when the order meets it — that is her
  promise.
- The server computes the charge; the client's figure is only a preview.
- Editing the bands follows the design rules: one page, not a wizard, and a
  Marathi label for every field (`docs/MARATHI-STYLE.md`).

## Signed-in devices, with sign-out, on her profile screen

*Added 25 September 2026.*

One account can be signed in on up to ten devices at once
(`MAX_SESSIONS_PER_USER` in `backend/src/auth/sessions.ts`), and signing in on
a new phone does not sign the old one out. Today nobody but an admin can see
where an account is signed in or end a session on a lost phone — she can only
log out of the phone in her hand. Google Play does not require this; it is for
"my phone was stolen" and for the handset a field coordinator shares.

The server half is already built and unused:

- `GET /api/auth/sessions` lists the caller's own live sessions (`client`,
  `createdAt`, `lastSeenAt`, `current`), and `DELETE /api/auth/sessions/:id`
  ends one of them, answering 404 for anyone else's.
- `api.sessions()` and `api.endSession()` in `frontend/src/lib/api.ts` wrap
  both. No screen calls them.

Done means:

- A "signed-in devices" section on the seller's profile (`screens/seller/Misc.tsx`)
  and on the buyer's, listing each session with its device and when it was
  last used, the current one marked "this phone" and without a sign-out
  button — Log out already does that.
- Signing a device out is a confirmation that states the consequence
  (that phone will need a new OTP), not "Are you sure?".
- Nothing extra for push: the FCM token lives on the session, so ending the
  session stops that phone's notifications.

To settle before building it:

- **Telling two phones apart.** `describeClient()` records only "Android",
  "Windows" and the like, so two Android phones are two identical rows. The
  last-used time may be enough; if not, record the phone model from the user
  agent at login. Do not store the raw user agent.
- **"Sign out everywhere else".** `revokeAllForUser()` is used only by
  closing an account and by an admin blocking a buyer, and it ends every
  session including the caller's; no route lets her use it herself. One
  button that ends every session but this one is probably the control a
  woman with a stolen phone actually needs.
- Every label in both languages, written separately (`docs/MARATHI-STYLE.md`).

## Move Firebase to Blaze, with a budget alert

*Added 25 September 2026.*

The live project is on the free **Spark** plan, where a daily limit is a hard
stop, not a bill: past 50,000 reads or 20,000 writes a day, Firestore refuses
requests until the reset. Because the server reads every document at each
start, reads grow with *documents × server starts*, and changes waiting on a
spent write limit exist only in memory — a deploy or an idle shutdown before
the reset loses them. `docs/CAPACITY.md` §4 and §10 have the numbers;
§4 *The ways out* names this as the cheapest fix.

Blaze keeps the same daily free allowance, so at today's volume it costs
nothing; past it, reads are about $0.06 per 100,000. Going over becomes a
small bill instead of an outage, and managed backups and point-in-time
recovery become available.

1. Firebase console → the **live** project → Usage and billing → Modify plan
   → **Blaze**, and attach a billing account.
2. Google Cloud console → Billing → **Budgets & alerts** → a budget on that
   project, e.g. ₹500 a month, with email alerts at 50%, 90% and 100%.
   A budget **alerts, it does not cap** — spending carries on past it — so
   the emails must go to someone who reads them.
3. Update the docs that assume Spark: `docs/CAPACITY.md` (§1 table, §4, §9's
   "act at 25,000 reads"), `docs/BACKUP.md` (the opening paragraph, and
   whether to turn on managed backups / point-in-time recovery alongside the
   GitHub Actions copy), and `docs/DEPLOY.md`'s "not on a day the Spark
   limits are spent".

The backup project can stay on Spark for now. It needs the same move before
the live database nears 50,000 documents, or its dated copies outgrow 1 GiB
— both during a district-sized year (`docs/CAPACITY.md` §4, *The backup
project*).

## Read documents per request instead of loading everything at start

*Added 25 September 2026. Not before the scale calls for it — see "When".*

The server loads every document into memory at start and answers from that
copy (*Persistence* in `CLAUDE.md`). That keeps every route synchronous and
every read free, and it is correct for exactly one process. Rewriting the
routes to read from Firestore per request is what lifts both ceilings that
design has: one instance, and a database that must fit in memory.

**When.** Only once one of these is actually true — until then the rewrite
costs more than it saves:

- one instance can no longer carry the traffic, and a second is needed;
- the database is heading for ~50,000 documents, where memory on 512 MiB and
  the whole-database re-serialise on every save become the limit
  (`docs/CAPACITY.md` §4, *The memory ceiling*);
- start-up time from the full load is long enough that buyers notice cold
  starts even with minimum instances at 1.

The read quota is **not** on this list. *Move Firebase to Blaze* (above)
fixes that for a few dollars, and on Spark this rewrite can spend reads
*faster* than today, not slower.

**What it buys.** More than one instance, and deploys that no longer overlap
two copies of the data. Starts that read nothing. No memory ceiling. Edits in
the Firebase console take effect at once instead of being overwritten by a
stale copy. The class of bug behind the 10 September deletion — an in-memory
copy that was wrong, treated as the truth — goes away. Scripts
(`admin:users`, `purge:demo`) read what they touch, not everything.

**What it costs — settle each before building:**

- **Reads move from each start to each request.** The session lookup becomes
  one read on every authenticated request. One catalogue page needs every
  LIVE product, each one's seller (`publiclyVisible`) and every review
  (`ratingsByProduct`). The admin console loads whole lists and sorts them in
  the browser. Without a cache, or ratings and counts stored as fields,
  ordinary browsing can out-read ten full starts a day.
- **Rules that scan a whole collection need another shape.** The
  duplicate-UTR check, slot counting, the per-village serial in the
  `SMB-<VILLAGE>-<NN>` ID, seller ratings and the dashboard counts each need a
  query with an index, or a stored counter. Closing a buyer's account
  rewrites her id across `orders`, `reviews`, `reports`, `complaints` and
  `sessions`, and erasing a seller touches her payments, listings, complaints
  and the reports about her — each a query per collection, and a write that
  must not half-finish. The sweeps that run at boot and on the 15-minute
  timer — seven-day account erasure (`sweepClosedAccounts`), session and
  auth-log pruning, and the leftover rejected and archived listings — need a
  scheduled job and a query each instead of a walk over memory.
- **Races that cannot happen today become possible.** One process runs one
  handler at a time against memory, so two requests cannot both take the
  last slot or both claim the same UTR. Slot limits, stock, duplicate UTRs,
  order transitions and single-use OTPs and registration tickets all need
  Firestore **transactions**.
- **State held in the process has to move out of it.** The rate limiter
  (`auth/rateLimit.ts`) is a `Map`; with two instances "three codes a day"
  becomes six. It needs a shared store.
- **Latency.** Each request pays network round trips, and reads made one
  after another (session → order → seller) add up on rural 4G.
- **Size of the rewrite.** `getDb()` has about 90 call sites in 15 files, and
  every helper beneath them becomes async. The diffed, batched `save()` gives
  way to explicit writes in each route — each one a place to forget a write.
  Tests that build a database in memory need the Firestore emulator or a
  fake.

**How.** One collection at a time, not all at once. Start with the ones that
grow without limit — `orders`, `reviews`, `sessions` — and keep the small,
slow-changing ones (`sellers`, `products`, `admins`) in memory until they
too need to move. `--max-instances=1` stays until the **last** collection
has moved; a single in-memory collection is enough for two instances to
overwrite each other.

Done means:

- `CLAUDE.md` *Persistence* and `docs/DEPLOY.md` §1 (*Exactly one instance*)
  describe the new model, and the one-instance warning is removed only when
  it is no longer true.
- `docs/CAPACITY.md` §4 counts reads per request, not documents × starts.
- `isBulkDelete()` is kept or replaced by an equivalent guard on any
  remaining batch path.
- Tests cover the transactions: two concurrent requests for the last slot,
  and the same UTR claimed on two orders at once, each succeed exactly once.
