# Shantai Mahila Bazar — Feature Specification

Women entrepreneurs sell, customers buy, admin monitors. Delivery is manual and handled
directly between seller and buyer. Sellers and customers use the **app** (mobile-first web,
shipped on Android as a WebView APK that loads the deployed site). Admin uses the **web** console.

Priority tags: **[P0]** build in the skeleton · **[P1]** needed before real launch · **[P2]** later.

> **Where this stands — 28 September 2026.** This spec was written before the build, and much of
> it is still intent. It has been checked against the code: where the build decided differently,
> the text now says what was built and why; a tagged item that does not exist is marked
> *(not built)*; and features that shipped without being in the plan are written into the section
> they belong to. `CLAUDE.md` describes current behaviour in more depth, and where the two
> disagree, the code is the answer. Work deliberately postponed is listed in `docs/FUTURE-SCOPE.md`.

---

## 1. Decisions to lock before building

These change the database shape, so they are cheaper to answer now than to migrate later.

| # | Question | Recommendation |
|---|---|---|
| 1 | Can one phone number be both seller and customer? | Yes, but as **two records, not one account with roles**: a seller is found by her phone, a buyer by `c-<phone>`, and the landing page's two doors (`/login/seller`, `/login/customer`) decide which one a sign-in opens. A session carries one role; there is no role switcher. |
| 2 | Cart with items from three sellers? | **Decided September 2026: one seller per cart.** The first shop a buyer adds from owns the cart until she empties it or orders; a product from another shop is refused with the name of the shop that holds it (`frontend/src/store/cartRules.ts`). Nothing is ever cleared on her behalf. Checkout still groups by seller and an order still carries a `groupId`, because a cart saved before the rule can hold two. |
| 3 | Is the ₹50 lifetime or does it expire? | **Decided September 2026: six months.** The shop stays open for 6 months from the admin's approval; then the whole shop pauses until a flat ₹50 renewal is approved, which puts back every pack and product as it was. Only `Seller.subscriptionEndsAt` is stored — see `shared/src/subscription.ts`. |
| 4 | Do product **drafts** consume a slot? | No. Only products that are live, pending approval, or paused. One product holds one slot: the seller cannot delete a submitted product to free it. Only an admin rejecting or taking down a product frees its slot (changed September 2026 — seller-side archiving let one pack rotate through unlimited products), and since 26 September 2026 that rejection **deletes the listing** on the spot, so the slot and the row go together. A woman with a bad listing asks an admin to take it down. |
| 5 | Does the platform take a commission on orders? | Recommend **no** in v1. The money goes buyer → seller directly via her UPI; the platform never holds it. That avoids payment-aggregator licensing entirely. |
| 6 | Who guarantees the delivery happened? | **Decided: the seller's word.** There is no delivery OTP. She marks the order delivered herself, and the order's event trail is what the desk reads if a buyer disputes it (`shared/src/orderFlow.ts`). |
| 7 | Languages | **Marathi (default) + English.** Hindi is easy to add later since the i18n layer is the same. |
| 8 | Android only for v1? | Yes — Android first, as a React Native WebView APK that loads the deployed site (`docs/DEPLOY.md` §6). The share-QR that motivated this is *(not built)*; iOS can wait. |
| 9 | How is a seller's service area defined? | A pincode list per seller — **as a hint, not a gate.** The only hard rule is Maharashtra (pincodes 40–44, minus Goa's 403), checked by `isMaharashtraPincode()`. Inside it, an order to a pincode she did not list still reaches her marked "outside your area", and Accept means "yes, I can get there". Her list is usually one pincode typed at registration, and refusing its neighbours threw away orders she wanted. |

---

## 2. The order lifecycle is the product

Delivery is manual, so the state machine carries everything. Every other feature hangs off it.

**This sequence is locked. Five states, in this order, no additions:**

```
PLACED → ACCEPTED → PACKED → OUT_FOR_DELIVERY → DELIVERED
```

`shared/src/orderFlow.ts` is the single source of truth: the server checks every move with
`canTransition()`, and the seller's buttons are drawn from `SELLER_ACTIONS`. **`DELIVERED` is the
end.** The plan had a sixth state, `COMPLETED`, reached automatically when a return window
closed; it was removed on 9 September 2026 because no screen could reach it and every real
order sat at `DELIVERED` with a greyed-out step below it implying something was still owed.

Payment is deliberately *not* a step in this chain — see below. Adding a payment state
into the middle is the change that would break it, because a cash order and a UPI order
have to walk the same screens.

### Happy path

| State | Who moves it | What gets captured |
|---|---|---|
| `PLACED` | Customer | items (name, price and quantity copied onto the order), address, landmark, pincode, payment mode; `outsideArea` when the pincode is not on her list |
| `ACCEPTED` | Seller | **how long delivery will take**, in her own words — optional, asked the moment she taps Accept (see below). No timer; an order waits until she answers |
| `PACKED` | Seller | nothing extra. On a UPI order she cannot reach this step until she has said the money arrived |
| `OUT_FOR_DELIVERY` | Seller | nothing extra; a confirmation that states the consequence first |
| `DELIVERED` | Seller | her word. **No delivery OTP** — see §1, decision 6. A cash order is marked collected at the same moment |

### Exceptions

| State | Who | Notes |
|---|---|---|
| `REJECTED` | Seller, only from `PLACED` | reason picked from a list: out of stock, can't deliver there, shop closed today |
| `CANCELLED` | Buyer, only while `PLACED` | reason from her list; after acceptance the button is gone and the screen says to call the seller |
| `CANCELLED` | Seller, from `ACCEPTED` to `OUT_FOR_DELIVERY` | reason from her list; then a refund screen (see below) |
| `RETURN_REQUESTED` → `RETURN_APPROVED` → `REFUNDED` | Buyer / Seller / Admin | *(not built)* — no returns or refunds in the app |
| `DISPUTED` | Either party | *(not built)* — a complaint to the desk (§8.4) is the nearest thing |

One `CANCELLED` state serves both sides; the event's `by` says who, and `reason` stores a code
rather than a sentence so each side reads it in their own language. "Other" is the only reason that
needs typed words (5–200 characters). `shared/src/orderCancel.ts` is the rule, and
`POST /orders/:id/cancel` the one route for both sides — which side is asking comes from the
session, never the body.

### Payment status is a separate axis

Because money moves buyer → seller directly, payment does **not** belong in the order state machine.
Track it in its own column:

`COD_PENDING` → `COD_COLLECTED` · `UPI_PENDING` → `UPI_SUBMITTED` → `UPI_CONFIRMED`

`COD_COLLECTED` is set by the move to `DELIVERED`; there is no separate "cash collected" button.
`UPI_SUBMITTED` means only that the buyer typed a reference number — a claim, not money.
`UPI_CONFIRMED` is reached only by the seller's own "payment received", made after she has looked
at her UPI app. There is no refund state: the app moves no money, so it cannot return any.

### Money after acceptance, not before

The buyer used to pay at checkout. Now a UPI order reaches the seller unpaid (`UPI_PENDING`), she
accepts if she can deliver, and only then does the buyer's order screen show the QR and the
reference-number box. Rejection is an ordinary outcome now that her area list is a hint, and a
rejected prepaid order left money in her account with no way back through the app. Two predicates
say whose turn it is, and both sides read them: `awaitingCustomerPayment()` and
`awaitingPaymentConfirmation()` — the second is what stops a UPI order at `PACKED`.

### When she cancels, the refund is hers to make

After a seller cancels, a fourth screen tells her what she owes back, read off the payment status by
`refundOwed()`: money she already confirmed, a reference number the buyer reported (check it), or
nothing reported (still return any cash or advance). It closes only on "I understand", and the
cancelled order's screen keeps saying it; the buyer's screen says the seller must send it back.

### Rules that matter

- Every transition appends an event to the order's own `events` list — the new state, when, who (`customer`, `seller`, `admin` or `system`), a note and, on a cancel, a reason code. There is no GPS and no separate table; `endingEvent()` finds the one that stopped an order, and both apps and the admin order panel draw who stopped it and why from it.
- **Phones are not masked.** Each side sees the other's number on the order from the moment it is `PLACED`: the gap between placing and accepting is when a buyer most needs to reach the seller, and `GET /orders/:id` answers only the two parties on it. Her number never appears on a public route (§9.1).
- **Stuck orders** are counted on the admin dashboard — `ACCEPTED` or `PACKED` with nothing for 24 hours, `OUT_FOR_DELIVERY` with nothing for 12. There is no alert and no nudge to the seller *(not built)*.
- The buyer's tracker shows **four stages, not five states**: Order confirmed (`ACCEPTED`), Shipped (`PACKED`), Out for delivery, Delivered — a date beside each stage reached, red for an order that ended. The seller's screens keep all five.
- **How long it will take.** Tapping Accept opens a sheet asking for a free-text estimate (up to 40 characters) with chips for the common answers. Skipping is allowed — an invented time is worse for the buyer than none — and whatever she writes is shown on both order screens as the expected delivery.

---

## 3. Registration fee & product slots

### The flow

₹50 buys one **pack**: 5 product slots. Want a 6th product? Buy another pack — 5 more slots, 10 total.
There is no payment gateway; she pays the admin's bank/UPI account directly and admin approves it by hand.

```
1. Phone + OTP                     → a single-use registration ticket (15 min)
2. Six-step wizard: about her, village, business, digital use, her UPI, check + consent
                                   → seller record created, status REGISTERED
3. PAYMENT SCREEN (not blocking)   → "pay now", or go to My Business first
   admin's UPI QR + payee name + UPI ID to copy + "₹50"; she pays from her own UPI app
4. She enters the 12-digit UTR, WHEN she paid, and uploads the success screenshot
5. status = PAYMENT_SUBMITTED      → she waits (a seller already ACTIVE stays ACTIVE)
6. Admin sees it in the approvals queue, ticks three checks against the bank statement
7. Approve  → status = ACTIVE, +5 slots, a six-month term starts, notice + phone push
   Reject   → reason shown, she can resubmit without losing anything
```

What changed from the plan, and why:

- **Registration needs a ticket, not a phone number.** `/sellers/register` takes the phone from the
  ticket `/auth/otp/verify` issued and ignores the one in the body; without it the endpoint minted a
  seller session for any number anybody typed.
- **Consent is recorded at step 2** — see §7, *Policies and consent*. Her tick is checked before the
  ticket is spent, so a missing tick does not cost her another OTP.
- **No SMS on approval.** The only SMS the app sends is the sign-in code. Approval reaches her as a
  notice in her updates list and a phone notification (§7).
- **Every ₹50 is PACK or RENEWAL** (`shared/src/subscription.ts`): a pack when her slots are full, a
  renewal from 7 days before her term ends, and only a renewal once the shop is paused. The server
  decides which she may pay for (`payableKinds()`) and her screen offers only that.
- **Inside the APK the ₹50 does not exist.** Google Play requires its own billing for anything that
  unlocks an app and forbids steering towards another way to pay, so inside the APK
  `/seller/subscription` shows the shop's status only — on or not yet, slots in use, open until
  when — with no price, QR or form, and every dictionary line that names the price has an `.apk`
  twin that does not. She pays at the desk or a field coordinator, and staff enter it with **Record
  payment** on her page in the console (cash, UPI or other), which applies exactly what approving a
  queued payment does. The website keeps its payment screen unchanged.

### Seller account states

| State | She can… |
|---|---|
| `REGISTERED` | fill profile, replay the screen walkthroughs, set up her shop — **cannot send a product for checking** (a draft is fine) |
| `PAYMENT_SUBMITTED` | same, plus a notice on My Business that she is waiting for admin approval |
| `ACTIVE` | everything, up to her slot count — **while her six-month term lasts**. Past `subscriptionEndsAt` the whole shop pauses without any status changing: nothing of hers can be found or ordered, orders already running carry on, and a ₹50 renewal puts back exactly what she had |
| `PAYMENT_REJECTED` | see the reason, fix it, resubmit |
| `BLOCKED` | admin-suspended, listings hidden; her own screens say she was blocked and show the admin's reason |
| `CLOSED` | she (or staff, on her behalf) asked for the account to be deleted — see §8.3. Shop hidden at once; erased after 7 days unless she signs in and restores it |

### The waiting screen **[P0]** — required

The moment she submits the reference number, she lands on a dedicated screen. Not a toast,
not a banner she can miss — a full screen that answers the only question she has: *did my ₹50
go through?*

It shows (as built, `/seller/waiting`):

- A large waiting icon — no error colours, nothing red
- **तुमच्या भरण्याची माहिती पाठवली आहे** — "Your payment details have been sent"
- **प्रशासकाच्या मंजुरीची वाट पहा** — "Please wait for admin approval"
- The expected wait in plain words: साधारण 24 तासांत मंजूर होईल
- What she submitted, echoed back: the amount, the reference number, the date and time
- A line saying what she can do meanwhile: set up her shop and see how each screen works
- Two buttons: **प्रशिक्षण पहा** (Watch training) and **मदत** (Help) — both open Help & Training, which has walkthroughs, WhatsApp and a phone number, but no videos yet
- *(not built)* the **"you will get an SMS when it is approved"** line — no SMS is sent, so the line would be untrue; a phone notification is sent instead
- *(not built)* a speaker button that reads the screen aloud

The screen checks every 10 seconds while it is open. The waiting state is also a notice on My
Business, and it resolves three ways:

| Outcome | What she sees |
|---|---|
| Approved | A notice and phone notification, and the waiting screen turns into **अभिनंदन! तुमची नोंदणी मंजूर झाली** — "आता तुम्ही 5 उत्पादने टाकू शकता" |
| Rejected | The reason in plain Marathi, and a **resubmit** button that keeps everything she already entered |
| Still waiting after 48 h | *(not built as specified)* — no button appears for her; the admin queue shows every payment's waiting time instead (minutes, hours, then days) |

Inside the APK there is no waiting screen: `/seller/waiting` goes to the status-only registration
screen (see *The flow* above).

> **Design note.** Don't lock her out of the app while waiting for approval. Approval is manual and could take hours; a woman who paid ₹50 and then hits a dead end will assume she was cheated. Let her into the dashboard in a "payment pending" state where she can set up her shop and watch training videos, with the publish button visibly locked. She stays engaged and admin gets a more complete profile to verify against.

### Slot accounting

- `slots_total` = approved packs × 5 · `slots_used` = products pending, live or paused
- **[P0]** A slot meter sits on My Business, My Products and her profile: `used / total` in Latin digits with one bar per slot, and a line saying how many more she can add. She must always know where she stands without doing arithmetic.
- **[P0]** At 5 of 5, the Upload tab opens on a lock icon and a button to the buy-more screen instead of the wizard; My Products disables its Add button with the same notice. Never a silent failure or a raw error. (It does not redirect on its own.)
- **[P0]** A seller cannot delete a submitted product. Its slot frees only when an admin rejects it or takes it down — which deletes the listing at that moment — and the reason reaches her as a notice in her updates list. Drafts hold no slot and she may delete them.
- **[P1]** Warn at 4 of 5: "one slot left" — on My Business.
- **[P1]** Admin can grant free slots manually (goodwill, a trainee batch, a demo account), and revoke them down to what she uses. A grant starts a term for a seller who has none but never extends one — time is paid.
- **[P2]** Bulk packs — ₹150 for 20 slots — once you know whether anyone buys a second pack. *(not built)*

### The six-month term

Decided September 2026 (§1, decision 3); `shared/src/subscription.ts` is the rule.

- **Only one date is stored**, `Seller.subscriptionEndsAt`. Expiry writes nothing — no product flipped to paused, no slot released — so renewal is the date moving and "everything exactly as before" is true by construction. Every public route asks `canSellNow()` (approved, not blocked, not expired).
- **Six calendar months from approval**, counted in India time and clamped at month end. One date for the whole shop however many packs she has; a flat ₹50 renewal renews them all. A pack bought mid-term adds slots and leaves the date alone; a renewal paid in the reminder week adds six months to the current end, so no paid days are lost.
- **The reminder is derived**, like the rest of her updates list: 7 days before the end her home and products screens carry a renewal notice, then "paused — renew" once it has passed; an approved renewal leaves a notice with the new date. Every screen is told the state by the server's clock, never the phone's.
- Existing sellers were given a term once, at the deploy, of never fewer than seven days, so no shop closed the morning after without warning.

### Payment fraud guards **[P1]**

- **Duplicate UTR detection** — flag if a reference number was already submitted by anyone. This is the obvious attack. *(built: a pill on the queue card)*
- **Proof, not twelve digits** *(built)*. A UTR must be exactly 12 digits, and a payment carries a **screenshot of her UPI app's success screen** (required while uploads are on, and only accepted from this app's own upload folder) and **when she paid** (not in the future, not more than 7 days old). The admin sees the screenshot beside the UTR, the time and the amount, and **Approve stays disabled until three checks are ticked** — UTR matches, date and time match, money is on the bank statement. The server refuses an approval without all three.
- Store the payer's UPI handle and name from the screenshot for the admin to eyeball. *(partly: a `payerUpi` is stored, but it defaults to the seller's own UPI ID — nothing reads it off the screenshot)*
- Rate-limit resubmissions *(not built; one pending payment at a time)*; log every approve and reject with the admin's identity *(built: `verifiedBy` and `verifiedAt` on each payment)*.

> **Scale warning.** Manual verification works fine up to a few hundred sellers, then it becomes a daily chore. When it hurts, the upgrade path is UPI auto-reconciliation against a bank statement feed, or a real gateway — not more admin staff. Build the queue so a future automated verifier can write to the same table.

---

## 4. Money flow — who pays whom

Two separate flows. Keeping them separate keeps the platform out of the payments business.

| Flow | From | To | Verified by |
|---|---|---|---|
| Registration / slot packs / renewals | Seller | **Admin's** account — the college's UPI ID, set by `ADMIN_PAYMENT_ACCOUNT` in `backend/src/config.ts` from the environment | Admin, manually, against the bank statement; or staff record a payment taken at the desk (§3) |
| Order payment | Customer | **The seller's own** UPI | The seller, in her app |

### Seller's UPI, captured at registration **[P0]**

**As built: she types it, and the app checks what she cannot proofread.** QR decoding (steps 1–4
below) is *(not built)*. Her UPI ID is a typed, required field on step 5 of registration, beside
an optional photo of her bank's own QR. `upiProblem()` in `shared/src/payment.ts` checks it on
both sides, at every place a UPI ID is entered: a handle within one or two letters of a known one
is refused **and named** ("तुम्हाला "@ybl" म्हणायचे आहे का?"), because she can read "sunita" back
but "ybll" looks exactly as right as "ybl"; an unknown handle that is not a near miss is accepted,
because new banks appear and locking a seller out of her real UPI ID costs her every order.

The original plan, kept for when decoding is built — **make her upload, not type.** Typing `sunita@ybl` correctly is a real barrier, and one wrong character sends every customer's money to a stranger. Instead:

1. **"Upload your QR"** — she picks the PhonePe/GPay QR screenshot from her gallery, or photographs it. One tap, something she already knows how to do.
2. The app **decodes the UPI ID out of the QR image** client-side (jsQR or ZXing reads the `upi://pay?pa=…` string embedded in it). No typing at all.
3. It shows the decoded ID back in large text: *"तुमचा UPI: `sunita@ybl` — बरोबर आहे का?"* with Yes / No buttons.
4. **Manual typing is the fallback**, not the default — offered only if the decode fails.

Security is unchanged by this, and in one respect improved:

- **[P0]** The decoded ID is what gets stored and paid into, so a typo is impossible by construction. That removes the highest-consequence data-entry error in the whole app.
- **[P1]** A ₹1 verification transfer confirms the handle is real and belongs to her, before her first order. *(not built — `upiVerified` exists and is cleared when she changes her UPI ID, but nothing sets it, so her profile says "not verified")*
- **[P1]** Admin sees the decoded ID **and** the uploaded QR image side by side in the verification queue and confirms they match. *(not built — her page shows the UPI ID and a "QR ready" pill, not the image)*
- **[P1]** Changing her UPI later re-enters the verification queue and notifies her old number — otherwise it's an account-takeover route. *(not built — she can change it from Edit profile)*

**Generate the QR rather than only showing her uploaded image.** *(built — `buildUpiLink()` in `shared/src/seller.ts`)* From her UPI ID the app builds a per-order QR with the exact amount already filled in:

```
upi://pay?pa=sunita@ybl&pn=Sunita+Tai&am=340.00&cu=INR&tn=Shantai+Mahila+Bazar+SMB1043
```

There is **no `tr`**: a transaction reference is a merchant field, and on a personal UPI ID it is one more thing a UPI app's risk check reads as a fake shop. An uploaded screenshot has no amount in it, so the customer has to type ₹340 by hand and can get it wrong. A generated QR cannot be mistyped. The buyer's pay card shows the generated QR, and her uploaded bank QR beside it when she has one — and **the amount in large figures on the screen**, because the buyer cannot read a QR.

### Customer payment — after acceptance **[P0]**

As built, a UPI buyer pays **after the seller accepts**, not at checkout (§2, *Money after acceptance*). With one seller per cart there is one payment step per order:

1. At checkout the customer picks **UPI** or **Cash on delivery**. Choosing UPI says plainly that nothing is paid now — only after the seller accepts.
2. Once accepted, her order screen shows the amount to pay, the seller's QR, the written steps for paying from the same phone, and the seller's UPI ID with a copy button. **There is no "पैसे द्या" (Pay now) button** firing a `upi://pay` intent: PhonePe and Google Pay decline a payment another app starts to a *personal* UPI ID "for security reasons" (tested on real phones, 14 September 2026), and every payee here is one. **A phone cannot scan its own screen**, so the steps say: take a screenshot of the QR, open PhonePe or Google Pay, scan, pick the screenshot from the gallery, check the name and amount — or copy the UPI ID and paste it there. Coming back after copying scrolls to the UTR box.
3. Customer enters the 12-digit UTR → `UPI_SUBMITTED`. The button stays disabled while the number cannot be right, and the same UTR cannot be claimed on a second order.
4. The seller sees **पैसे मिळाले का?** on the order with a **होय, पैसे मिळाले** button → `UPI_CONFIRMED`. Only then can she pack.
5. If she doesn't move the order for 24 hours, it counts as stuck on the admin dashboard.

> **Consequence to accept.** Since the platform never holds the money, the platform also cannot refund it. A refund is the seller sending money back, which admin can only chase, not enforce. Say this plainly in the return policy, and give the dispute desk the power to block a seller who won't refund. This is the price of not needing a payment aggregator licence, and for v1 it is the right trade. *(As built: the Returns and Refunds policy says so; a seller who cancels is shown what she owes back (§2); and an admin can block a seller. There is no dispute desk beyond the complaints queue.)*

---

## 5. Share QR & app install link

> **Status, 28 September 2026: not built.** Nothing in either app draws a shop QR, a poster or a
> share button — the share surfaces were removed (the growth screen's Share button went on
> 26 September 2026), and the wrapper has neither App Links nor the Install Referrer API. What is
> left is plumbing with nothing calling it: `POST /api/catalog/share/:slug/scan` still counts
> `qrScans`, an order carrying a `sourceShareCode` that matches the shop counts `qrOrders`, and the
> admin's seller page prints the scan count. The shop page a QR would land on does exist,
> `/shop/seller/:sellerId` (§9.1), though only for a signed-in buyer. The QR a seller *does* have,
> on `/seller/payment`, is her **payment** QR — generated from her UPI ID for buyers to pay into —
> not a link to her shop.

After her profile is approved, generate a QR she can print, stick on her door, and put on WhatsApp status.

### What the QR encodes

A short link on **your own domain**, never a vendor's: `https://shantaimahilabazar.com/s/sunita-pickles`

### What that link does

| Situation | Behaviour |
|---|---|
| App installed (Android) | **Android App Links** open her storefront directly in the app |
| App not installed | The web page shows her shop, then sends them to the Play Store |
| After they install | The app opens **on her storefront**, not the generic home screen |

That last row is *deferred deep linking*, and it's the hard part.

> **Do not use Firebase Dynamic Links.** It was shut down on 25 August 2025 — link creation, analytics and deferred deep linking are all dead. Most tutorials you'll find still recommend it.

**Recommended approach — free and native [P1]:**
Append the shop code to the Play Store URL as a referrer, and read it back on first launch with the **Play Install Referrer API**:

```
https://play.google.com/store/apps/details?id=in.shantai.mahilabazar&referrer=shop%3Dsunita-pickles
```

Google supports this natively on Android, it costs nothing, and no vendor can shut it off. On first launch the app queries the referrer, finds `shop=sunita-pickles`, and routes there. If you later ship iOS, that's when to evaluate Branch or AppsFlyer OneLink — pay for it only when you actually need it.

### The QR as a real object **[P0]**

- Generated as a **shareable poster image**, not a bare QR: her photo, shop name in Marathi, "स्कॅन करा आणि ऑर्डर करा", and the QR.
- One-tap **Share on WhatsApp** and **Download** — she will use both constantly.
- **[P1]** A printable A5 PDF version for her door or a stall.
- **[P1]** Admin can bulk-generate posters for a whole training batch.

### Track it **[P1]**

Log scans, installs and orders per shop code, then show her the number on her dashboard: *"12 लोक तुमच्या QR मधून आले"*. It turns an abstract feature into something she can feel, and it tells you whether the channel works at all.

---

## 6. Designing for rural, first-time smartphone users

You called this the most important requirement, so it gets its own section and it constrains
every screen in the spec. The assumption throughout: **she may be reading slowly, this may be her
first app that isn't WhatsApp, and the phone is probably shared.**

### Non-negotiables **[P0]**

- **Marathi is the default**, not an option buried in settings. *(As built: there is no separate language screen; the landing page opens in Marathi with a **मराठी** / **English** switch in its header, and both profiles and the policy pages carry the same switch.)*
- **Every icon carries a Marathi label.** Icons alone are guesses. A truck icon means nothing; "पाठवले आहे" does.
- **Numerals stay in Latin digits** (₹500, not ५००) — that's what's printed on money and shown in every UPI app.
- **Minimum 16px text, 56px buttons, 44px touch targets.** Assume an inexpensive phone and imperfect eyesight.
- **No hamburger menu, no nested drawers.** Four bottom tabs, one level deep. If it doesn't fit in four tabs, it doesn't belong on the dashboard.
- **One question per screen** in every multi-step flow, with progress dots so she can see the end coming. **Editing is not a wizard**: the edit-product screen puts every field on one page, because four taps between her and the price she came to change is not simplicity.
- **Photo before keyboard.** *(As built: product photos come from the **gallery** only — one photo, compressed on the phone. There is no camera capture; the camera permission stays declared and never granted in the APK precisely to keep the picker to the gallery.)* Anywhere text is unavoidable, put a **voice input** button next to the field — built as an addition, never a replacement: the keyboard always stays, and the mic does not render where the phone cannot do speech.
- **Plain words, no jargon.** Not "SKU", "inventory", "listing status", "dashboard". Use "माझा व्यवसाय", "माझी उत्पादने", "किती शिल्लक आहे". Marathi follows one source, `docs/MARATHI-STYLE.md`.
- **Colour plus icon plus word** for every order state — never colour alone: a line icon and the word, e.g. ऑर्डर आले · पाठवले आहे · पोहोचले. **No emoji anywhere** in the three apps — icons come from one file per app (`components/icons.tsx`).
- **Errors say what to do next**, in Marathi, never a code. "सर्व्हरशी संपर्क झाला नाही. इंटरनेट तपासा आणि पुन्हा प्रयत्न करा." with a retry button. Every API error carries a Marathi message.
- **Confirm destructive things, undo everything else.** A confirmation dialog must spell out the consequence — "हे अपूर्ण उत्पादन अजून पाठवलेले नाही, त्यामुळे त्याला जागा लागत नाही. काढले तर भरलेली माहिती परत मिळणार नाही." — not "Are you sure?"
- **An empty state never repeats the action already standing in the bar below it** — a second "New product" button reads as a different thing, not the same one.
- **No web fonts.** Android ships Noto Sans Devanagari, so Marathi renders from system fonts at zero network cost. Every colour, size and radius is a token in the one `:root` block of `frontend/src/styles/theme.css`.

### High-leverage additions

- **[P1] Audio help on every screen.** A speaker button that reads the screen's instructions aloud in Marathi. This is the single biggest accessibility win for a low-literacy user, and it's cheap — pre-recorded clips, not TTS. *(not built)*
- **[P1] A 30-second how-to video** embedded at the top of each major screen, collapsible once she's watched it. *(not built)*
- **[P1] Guided first product.** After approval, walk her through adding product #1 with coach marks. The first success is what determines whether she comes back. *(Built differently: every bottom-tab screen, on both sides, explains itself with a ringed walkthrough the first time she opens it — `frontend/src/lib/tours.ts` — and she can replay any of them from Help & Training or the buyer's profile.)*
- **[P1] Offline tolerance.** A clear "इंटरनेट नाही" banner, a retry queue for order status updates, and cached product lists. Network in villages drops constantly and she must never lose typed work. *(Partly built: a full-screen **इंटरनेट बंद आहे** notice once the site has loaded, which says what she typed is safe and retries; the half-filled product wizard is saved on the phone and a half-filled seller registration survives a reload; screens she returns to paint their last answer at once while they refetch. No retry queue.)*
- **[P1] WhatsApp support** as a first-class channel — she already lives there. A help button that opens WhatsApp with her seller ID pre-filled beats any in-app ticket form. *(Built: Help & Training and the buyer's profile carry WhatsApp and phone buttons for the office, beside a complaint form — §8.4.)*
- **[P2] Shared-phone safety.** A quick PIN lock on the seller section, since the phone may be the household's. *(not built. What exists for shared phones: the product draft is keyed to the seller, one phone receives notifications only for whoever signed in on it last, and the screen cache is cleared when a session ends.)*

---

## 7. Shared foundations

Built once, consumed by all three roles.

- **[P0] Auth** — phone + OTP, role chosen at the landing page's door, persisted session. Rate-limit OTP sends. Email and password only for admin. As built (`backend/src/auth/`, detail in `CLAUDE.md`):
  - **OTP** goes through MSG91's widget in production (the browser sends and checks the code; the server trades the widget's token for the number and refuses it unless it matches). Without the widget, a 6-digit server code, 5-minute life, destroyed after 5 wrong guesses.
  - **Sends are capped at three codes per number per 24 hours** (an SMS bill, not a security knob), and every limit is keyed by both number and IP. A refusal says when to try again in days or hours, not "1440 minutes".
  - **Not a JWT.** The token is a signed pointer to a row in `sessions`, so it carries no identity and deleting the row signs the phone out at once. **Idle windows**: 15 days for sellers and buyers, 8 hours for admins, with absolute ceilings of 90 and 7 days; past halfway the server hands back a fresh token. Only Log out and a 401 end a session — Back, refresh and re-opening never do.
  - **No guest browsing** *(not built)*. Everything under `/shop` needs a signed-in buyer; the landing page shows no products, and its category tiles lead to sign-in. (The catalogue API itself is public.)
  - **Admins** are named database accounts with scrypt-hashed passwords, made with `npm run admin:users`. No 2FA *(not built)*.
- **[P0] i18n** — Marathi and English, every string in a resource file (`frontend/src/i18n/strings.ts`, `admin/src/i18n/strings.ts`) including categories, notifications and error messages — placeholders too. Marathi default; the English dictionary is written independently, not translated. There is no SMS text beyond the sign-in code.
- **[P0] Mobile shell** — bottom tab bar, four tabs per role, safe-area insets, back handling. Admin gets a desktop sidebar instead. Seller tabs: माझा व्यवसाय · उत्पादन टाका · माझी माहिती · मदत व प्रशिक्षण. Buyer tabs: वस्तू पहा · प्रकार · टोपली · माझी माहिती.
- **[P0] Media** — client-side image compression, CDN storage, lazy loading. As built: **one photo per product**, from the gallery, re-encoded as JPEG on the phone (1200px, ~350KB) and uploaded straight to Cloudinary with a short-lived signature; nothing over 5MB is accepted, and a stored photo URL must be one this app uploaded. A listing with no photo shows a photo of its *category*, never of someone else's product. Skeleton placeholders *(not built — a spinner, and a returning screen repaints its last answer)*.
- **[P0] Legal pages** — terms, privacy, return and refund policy, seller agreement, FSSAI disclosure, and a clear statement that payment is direct between buyer and seller. *(Built — see* Policies and consent *below.)*
- **[P1] Notifications** — push, SMS and WhatsApp, plus an in-app inbox. *(As built: **phone push** and an **in-app updates list**; no SMS or WhatsApp messages. See* Notifications as built *below.)*
- **[P1] Order chat** — scoped to one order, buyer to seller, masked numbers. *(not built — both numbers are on the order instead, with Call and WhatsApp buttons)*
- **[P1] Search** — server-side index, autosuggest, typo tolerance, and it must handle Marathi queries. *(As built: one search box on Explore that matches the typed text inside the Marathi and English product names, on the phone. No autosuggest, no typo tolerance, no transliteration.)*
- **[P1] Low-network handling** — cached catalog, retry queue, small payloads. *(Partly: a screen cache that repaints the last answer, compressed photos, and `/catalog/products?sellerId=` so "more from this shop" costs three products rather than the catalogue. No retry queue.)*

### Policies and consent **[P0]** — built September 2026

Five documents — privacy policy, terms of use, seller agreement, returns and refunds, grievances and
contact — in Marathi and English, written independently (`frontend/src/legal/`), at the public
routes `/legal` and `/legal/:docId`. Public because the Play Console needs a privacy-policy URL a
browser can open, and a buyer should read the terms before giving a number.

- The operator and the grievance officer are named once, in `legal/operator.ts`, and quoted by every document. Every number in the text — ₹50, two edits, seven days, thirty days — is imported from the rule that enforces it, so the policy cannot drift from the code.
- **Consent is recorded, not assumed** (`shared/src/legal.ts`): `acceptedPolicies: { version, at }` on the seller and buyer record, kept even after an account is erased, because it is the evidence. The seller's last registration step and the buyer's name screen each carry a tick-box that also confirms she is an adult — "मी वरील अटी आणि धोरणे वाचली आहेत, मला ती मान्य आहेत, आणि माझे वय 18 किंवा त्याहून जास्त आहे" (the seller's names "करार" too). The server refuses anything but a literal `acceptPolicies: true`.
- **Everyone else meets a one-time gate** over the whole app, titled **बाजाराचे नियम**, until they accept; its button reads **मान्य आहे, आणि माझे वय 18 किंवा त्याहून जास्त आहे**. If the check fails offline it lets her through — never lock a woman out of her own shop over a network blip.
- **`POLICY_VERSION` is the effective date** (currently 2026-09-27). Moving it asks every signed-in person again, so it moves only when what someone agreed to changes.
- The seller agreement tells a food seller that FSSAI registration is her responsibility; the terms and refund policy say that buyers pay sellers directly and every refund comes from the seller.

### Notifications as built **[P1]**

- **The updates list** (`/seller/notifications`, `/shop/notifications`, behind a bell) is **derived, never stored**: one row per order, named after what is in it and wearing its current status, from the other side's actions only; plus one row per admin decision about her account (payment approved or rejected, slots granted, product approved or rejected, blocked, renewed) and the subscription reminder.
- **Phone push** (Firebase Cloud Messaging, **APK only**) says the same words as the list, in the app's language: a new order and a cancellation to the seller; every step the seller makes to the buyer; "the buyer says she paid" to the seller; every admin decision to the seller. The token lives on the session, so logging out stops it, and one phone buzzes only for whoever signed in on it last. A send never fails a route.
- **A refused permission is not invisible.** Inside the APK, when Android reports notifications refused, a notice says **फोनवर सूचना बंद आहेत** — "तुमच्या ऑर्डरबद्दल फोनवर सूचना येणार नाहीत. फोनच्या सेटिंगमध्ये या ॲपसाठी सूचना चालू करा." — with **सेटिंग उघडा** and a skip for this launch. Help & Training carries a card for phones that block notifications.
- Not built: SMS and WhatsApp messages, review-request, low-stock, FSSAI-expiring and one-slot-left notifications (one slot left is a line on My Business instead).

---

## 8. Entrepreneur app — 4 sections

### 8.1 My Business

The daily driver. This is the screen she opens the app for.

**Top of screen [P0]**
- Notices first, when they apply: blocked (with the admin's reason), **account closing** (days left and a restore button, §8.3), the subscription reminder or "paused — renew", and waiting for approval
- **Slot meter** — `used / total` with one bar per slot, "आणखी {n} उत्पादने टाकू शकता", "फक्त एक जागा शिल्लक आहे" at one left, and a "जागा वाढवा" button when full
- Earnings today and orders today. *(Pending-action count and week / month earnings: not on this screen — the week is on Growth.)*
- **Shop open/closed toggle** — one tap to pause when she's out; while her term has expired it is replaced by a "shop paused" card
- Her rating — her products' reviews taken together — opening `/seller/reviews`
- Tiles to Products, Orders, Growth and Buyers

**Action queue [P0]** — the most important widget in the app, titled **तुमचे लक्ष हवे**
- Every order waiting on her, each row naming what to do next: accept, **पैसे मिळाले का?** for a UPI order the buyer says she paid, pack, send, mark delivered. No countdown — there is no acceptance timer.
- Every row taps straight through to the order

**Orders [P0]**
- Tabs: Needs your attention · Accepted (accepted, packed and on the way) · Delivered · Cancelled (rejected and cancelled). No Returns tab — returns are *(not built)*.
- Order detail: status, the delivery estimate she gave, who ended it and why, the refund still owed, the buyer's reviews of this order, an **outside your area** warning, the payment state, items and total, the buyer's name, address and landmark with **Call** (the number is not masked — §2) and **नकाशावर पहा** (Open in Maps), and a timeline of the five states with times
- Buttons mirroring the state machine: Accept (asks how long delivery will take) · Reject (with a reason) · Mark Packed (hidden until a UPI payment is confirmed) · **Mark Out for Delivery** (confirms first) · **Mark Delivered** — no OTP · **होय, पैसे मिळाले** (payment received). Cash needs no button: delivering a cash order marks it collected.
- **Cancel** with a reason, below the content rather than in the action bar, then the refund screen (§2) · **Report this buyer** (§10, *Reports*) · chat and a simple bill *(not built)*

**My products [P0]**
- Slot meter repeated at the top, and the subscription notice
- Photo, price and size, stock (out of stock / made to order / in stock: N), status: live / draft / pending approval / paused — or "paused" on every live listing while her term has expired. A rejected listing no longer appears: rejection deletes it, and the reason arrives as a notice.
- Actions — tap to edit, pause and unpause a live listing, **delete a draft** (a submitted product cannot be deleted by her). In-stock toggle, duplicate *(not built)*; price and stock are changed on the edit screen, always free (§8.2).
- Low-stock highlighting and "pause all products" *(not built)*; the shop open/closed toggle does the holiday job for the whole shop.

**Shop settings [P0]**
- Shop name and her story — editable from her profile. Logo and cover photo *(not built)*.
- Opening hours, weekly off *(not built)*; holiday mode is the open/closed toggle.
- **Delivery areas** as a pincode list, delivery charge, free delivery above a threshold, minimum order value — stored on her record and read by the buyer's cart, but **no seller screen edits them** after registration, which asks only for her pincode. A charge of 0 is therefore the usual case, and the buyer is told to ask her rather than told delivery is free (§9.3).
- Preparation and dispatch time, pickup-from-home, return policy *(not built; dispatch time was removed from registration on 26 September 2026)*

**My QR [P0]** — the shareable poster, share to WhatsApp, download, and the scan count *(not built — §5)*. What exists is **My payment QR** (`/seller/payment`): the QR generated from her UPI ID that buyers pay into, with the chance to change the ID.

**Rest of the section**
- **[P1] Earnings** — order-wise earnings, cash collected versus pending, UPI received, downloadable monthly statement *(not built beyond today's figure and the Growth screen)*
- **[P1] Reviews** — read, reply, report abusive ones. *(Built: `/seller/reviews` shows every visible review of her products, each naming its product, with her overall rating on top; she can **report** a review. Reply is *(not built)*.)*
- **[P1] My buyers** *(built, not in the plan)* — `/seller/buyers`: everyone who has ordered from her, with order count, total spent, last order and address, a repeat-buyer mark and a Call button.
- **[P2] Insights** — views versus orders, top products, repeat customers, where her visitors came from *(partly — see §13.1)*
- **[P2] Offers** — percentage off, flat off, combos, free delivery above a value *(not built)*
- **[P2] Later** — batch and expiry tracking for food, raw-material records *(not built)*

### 8.2 Upload Product

A guided wizard, one question per screen, autosaving on the phone as she goes (keyed to her seller
id, so on a shared handset the next woman never finds a stranger's photo). Never one long form —
that's where first-time sellers give up.

**As built, seven steps** (`frontend/src/screens/seller/UploadProduct.tsx`): photo · name ·
food or not · details (category, then the food or non-food fields) · price and size · stock ·
preview. The numbered steps below are the plan, annotated.

**Gates before step 1.** If her shop is not yet approved, or her term has expired, the tab says so
instead of opening the wizard. If she's at 5 of 5, she sees a lock and a button to the buy-more
screen instead of the wizard, phrased as an opportunity, not an error.

- **[P0] Step 1 · Photos** — *(as built: **one** photo, from the gallery only, compressed on the phone; required unless uploads are switched off. No camera, no crop, no second photo.)* **[P2]** short video *(not built)*.
- **[P0] Step 2 · Basics** — *(as built: the name, with voice input. The category is chosen on the details step from a flat list — no subcategories, no description, no tags.)*
- **[P0] Step 3 · Is this an eatable item?** The branch everything else depends on. It cannot be changed afterwards, because it decides which claims the listing carries.

**If YES — food. Four fields, nothing else:**

| Field | Notes |
|---|---|
| **FSSAI number** | *(Not in the wizard.)* An FSSAI number is **optional** — most women here cook at home below the registration threshold, and a required licence would shut them out. It is asked once, at seller registration, only if she sells food: exactly 14 digits when given (`fssaiProblem()` in `shared/src/seller.ts`), spaces and hyphens dropped, no first-digit rule. It is stored on her record, shown on her admin page, and **public**: on her seller card and printed on each of her food listings (the seller agreement and privacy policy say so). Because a mistyped or lapsed number is then on every listing, she can **change or remove it from Edit profile** — blank removes it (`editedFssai()`). A listing can also carry its own `fssai`, which the server checks the same way and the product page prints in preference to hers — but no seller screen sets it yet. |
| **FSSAI expiry date** | *(not built)* — nothing is stored, so there is no auto-hide job and no expiry warnings. |
| **Ingredients** | Free text with **voice input** — she speaks it, she doesn't type it. |
| **Veg / Non-veg** | Two big buttons with the veg and non-veg marks, drawn in CSS like the printed FSSAI mark. One tap. |

**If NO — non-food. One field:**

| Field | Notes |
|---|---|
| **Material** | Free text with voice input, plus quick-pick chips for the common ones — as built: cotton, silk, wool, clay, wood, brass, bamboo, jute. |

> **What was cut, and why it's safe.** Earlier drafts also asked for a certificate photo, allergens, net weight, shelf life, storage instructions, prep time, size, colour and care instructions. That's 12 fields where 4 will do, and every extra field is a place a first-time seller abandons the form. Admin can verify an FSSAI number directly on the FSSAI public licence portal without her uploading a photo of the certificate. The dropped fields move to **[P2] optional extras**, shown behind an "अधिक माहिती द्या (optional)" link for sellers who want a richer listing — never blocking the first publish. *(Status: the optional extras are not built. **Size** came back on 26 September 2026, required, as `packSize` in step 4 — a price with no size cannot be compared with the shop next door.)*

- **[P0] Step 4 · Pricing** — MRP (optional), selling price, unit (kg, g, piece, dozen, litre, ml, set), and **what size one is** *(built 26 September 2026)*: `packSize` counted in the unit (500 with g), and for a **set** how many pieces are in it (`piecesPerPack`) — a set of four ladoos and a set of twenty are the same word. A price with no size cannot be compared with the shop next door, so both are required on anything submitted (`sizeProblems()`); the product page prints it, e.g. "500 ग्रॅम" or "1 सेट (6 नग)". Auto-computed discount, **variants**, minimum and maximum order quantity *(not built — the product page strikes through the MRP when it is higher, with no percentage)*.
- **[P0] Step 5 · Stock** — quantity, or made-to-order for unlimited (a buyer can then take up to 20). Low-stock threshold, available days *(not built)*.
- **[P1] Step 6 · Delivery** — package weight, delivery charge inherited from the shop or overridden, serviceable pincodes, dispatch time. *(not built)*
- **[P1] Step 7 · Policies** — returnable or not, replacement window, cancellation window. *(not built — the returns and refunds policy covers every listing alike)*
- **[P0] Step 8 · Preview and submit** — see it as the customer will, with chips to jump back to any step, then save as draft (**नंतर पूर्ण करते**) or **send it for checking** (**तपासणीसाठी पाठवा**). **Show the slot cost: "हे प्रकाशित केल्यावर {used} / {total} जागा वापरल्या जातील."** Voice input is on the name, ingredients and material.
- **[P1] Helpers** — copy from an existing product, category templates that pre-fill fields, inline photography tips, a warning if the price looks below cost. *(not built)*

**Nothing goes live until an admin publishes it** *(decided September 2026)*. `initialListingStatus()`
never returns `LIVE`: submitting lands on `PENDING`, and the admin's approval is the only way to
`LIVE`. A listing carries a photograph, a price and, on food, an ingredients claim that goes out
under this market's name, so somebody looks before a shopper does. The slot is spent at submission,
a refusal carries a reason she reads in her updates list, and a live listing she edits stays live.
Her side says "send for checking", never "publish", because a woman refreshing the shop for a
listing nobody has approved has been told nothing by a screen that said "published".

**Editing a published listing** is one page, not the wizard (`EditProduct.tsx`), and **a live or
paused listing may be changed twice** (`MAX_EDITS`). Name, photo, category, ingredients, veg mark,
material, unit, MRP, size and made-to-order each spend an edit; **price and stock never do**,
because a seller who cannot correct a price stops keeping it honest. A save that changes nothing
costs nothing, drafts and rejected listings are not counted, and the screen says how many changes
are left and disables what has run out.

### 8.3 My Profile

- **[P0] Personal** — name, verified phone, her SMB ID (`SMB-<VILLAGE>-<NN>`, numbered per village so the code tells a field coordinator where to go), age, education, WhatsApp number; her initials stand in for a photo. Language is the switch on this screen. Date of birth, profile photo *(not built)*.
- **[P0] Business identity** — shop name, her story, business type (individual or self-help group, with the group's name), years in business, monthly capacity, village, taluka, district. Phone, village and SMB ID cannot be changed from the app. Udyam number, GSTIN, map pin, pickup address *(not built)*.
- **[P0] Payment details** — **her UPI ID** with a copy button and **My payment QR** (`/seller/payment`), plus the optional photo of her bank's QR on Edit profile. This is what customers pay into, so it deserves its own screen, not a buried field. The verification badge is shown but nothing sets it yet (§4).
- **[P0] My subscription** — slots total and used, the shop's end date, and **buy 5 more for ₹50** when she is full (renewal from the reminder week). Inside the APK this is the status-only registration screen, with no price (§3). Payment history with dates and UTRs *(not on her side; the admin's seller page has it)*.
- **[P0] Digital readiness** — her readiness score and band, from six self-reported answers at registration and four measured by the platform from what she actually does (`shared/src/readiness.ts`); the before/after comparison the programme reports on depends on keeping that split.
- **[P0] Addresses** — pickup and personal *(not built beyond her village and pincode)*
- **[P0] Settings** — language, the policies (§7), logout, and **delete account** (below). Notification preferences, hide my phone number, change phone *(not built)*.
- **[P1] KYC** — Aadhaar or PAN masked after saving, bank account with IFSC, status badge: pending / verified / rejected with reason *(not built)*
- **[P1] Group affiliation** — SHG or Shantai group name, village, taluka, district, coordinator contact *(partly: SHG name and location, above)*
- **[P1] Document locker** — FSSAI certificate, Udyam, ID proof, each with an expiry and a reminder *(not built; the FSSAI number alone is kept — §8.2)*
- **[P1] My tickets** — support requests and disputes she raised *(not built: complaints are sent, not tracked on her side)*
- **[P2] Badges** — Verified Seller, Top Rated, 100 Orders. Cheap and genuinely motivating. *(not built)*
- **[P2] Refer another woman** — invite link with a reward *(not built)*

**Deleting an account [P0]** *(built September 2026; Google Play requires it in the app and on a web page)*

`shared/src/accountClose.ts` is the rule; `CloseAccountSheet` is the screen, on both sides. The
public page is **`/delete-account`**, linked from the landing footer — the URL that goes in the Play
Console.

- **The entry point is nowhere near Log out**: its own card at the very bottom of the profile, a quiet line rather than a red button (**माझे खाते कायमचे बंद करा**). The sheet then shows what it costs her (her own listing count, and that the ₹50 is not refunded), asks why she is leaving (a list, "other" needs words), and asks for **the last four digits of her own number, typed** — not a word to copy, which is a literacy test, and not a second OTP.
- **An order in flight refuses the close**, and the sheet names the orders rather than printing an error.
- **A seller gets seven days.** Her shop closes and every session ends the moment she asks; the erasing happens seven days later (`UNDO_DAYS`). Signing in during that week puts **तुमचे खाते बंद होत आहे** at the top of My Business with one button, **खाते परत सुरू करा**, which restores everything.
- **The row stays and the person is erased**: every field that is her — phone, name, photo, village, UPI, readiness answers, the admin's notices — is emptied, her listings are emptied and removed with their photos, her Cloudinary images destroyed; the id, the SMB ID printed on packaging, the `CLOSED` status and the money records stay. Her phone number is free to register again — closing is not a ban.
- **A buyer gets no window**: what she loses is an address book, and signing in again gives her a new empty account. Her orders keep their items but lose her name, phone, address and landmark, and her id is rewritten to a random tombstone so her number appears nowhere afterwards. Reviews she wrote keep their stars and lose her name.
- **Staff can close an account for somebody who cannot sign in** — the lost phone, the code that never arrives — because the policy promises it by phone, WhatsApp or email. The console records how the request came, requires a tick that staff **rang the registered number back** and she confirmed, and for a seller her last four digits; the effect is exactly her own button's (§10).

### 8.4 Help & Training

What makes the platform work for a first-time seller. A real feature, not a FAQ dump.

As built, the tab (`/seller/help`) holds: the **walkthrough menu** — replay the explanation of any of her four screens; a **contact card** with WhatsApp and Call buttons for the programme office and **तक्रार नोंदवा** (Raise a complaint); three FAQ questions; and a card for phones that block notifications.

- **[P0] How-to videos** — short, vertical, **in Marathi**: how to pay the ₹50 and send the reference number, how to add a product, how to photograph with a phone, how to pack, how to mark out-for-delivery, **how to check money came into your UPI**. Downloadable for offline **[P1]**. *(not built — "Watch training" on the waiting screen opens this tab, which has walkthroughs, not videos)*
- **[P0] Step-by-step guides** with screenshots, searchable *(built differently: the ringed walkthroughs on the real screens, `frontend/src/lib/tours.ts`)*
- **[P0] FAQ** with search — lead with "मी ₹50 भरले पण मंजूर झाले नाही" and "पैसे कधी मिळतील?" *(partly: those two questions and "ऑर्डर आल्यावर काय करायचे?" are listed, with no answers yet and no search; inside the APK the first reads "माझे दुकान अजून सुरू झाले नाही")*
- **[P0] Contact support** — in-app chat, request a call-back, **WhatsApp link**, helpline number *(built: WhatsApp and Call to the office's number; in-app chat and call-back not built)*
- **[P0] Raise a complaint or dispute** — attach an order, add photos, track status *(built as the complaints desk, below; attaching an order or photos and tracking status are not built)*
- **[P1] Business courses** — modules → lessons → quiz → certificate. Pricing, packaging, talking to customers, **how to apply for FSSAI**, food hygiene, digital payments and fraud awareness, Udyam and GST basics, selling on WhatsApp. *(not built)*
- **[P1] Progress tracking** — percentage complete, resume where she left off, certificate *(not built)*
- **[P2] Live sessions** — webinar calendar, register, reminder, recording *(not built)*
- **[P2] Community feed** — announcements, other sellers' success stories, tips *(not built)*
- **[P2] Downloadables** — label template, price tag, WhatsApp-status poster *(not built)*
- **[P2] Government schemes** — MUDRA, PMEGP, Mahila Udyam Nidhi explainers *(not built)*

**The complaints desk [P0]** *(built 26 September 2026; `shared/src/complaint.ts`)* — for what needs
a person to look at *her* account: the ₹50 never approved, the order that never arrived. A sheet
from Help & Training, and from the buyer's profile (§9.4), asks what it is about — **पैसे किंवा
भरणा**, **ऑर्डरबद्दल**, **उत्पादनाबद्दल**, **माझे खाते**, **इतर काही** — and what happened (10–500
characters, voice input), with a WhatsApp link for something urgent. It is stored with who wrote it,
their number and SMB ID, so the desk can open her account and ring her back; the admin console's
Complaints screen works through them and records who resolved each one (§10).

---

## 9. Customer app — 4 sections

### 9.1 Explore Products

- **[P0] Home** — *(as built: a search box and a grid of the whole catalogue, each card with photo, name, price, size, stars when there are any, and its own add control. Pincode selector, banners, category strip and rails are not built; the grid is deliberately not filtered by pincode, because the seller's area list is a hint (§1, decision 9).)*
- **[P0] Search** — autosuggest, recent searches; **[P1]** typo tolerance and Marathi queries *(as built: a text match on the Marathi and English names, on the phone — §7)*
- **[P0] Filters** — price range, rating, veg/non-veg, discount, in stock, **delivers to my pincode**, seller, distance *(not built)*
- **[P0] Sort** — relevance, price, rating, newest, nearest *(not built)*
- **[P0] Product detail** — as built: **one photo**, price with the MRP struck through when higher, size ("500 ग्रॅम"), in stock / out of stock, the veg mark, ingredients or material, **the FSSAI number when the listing carries one** (§8.2), delivery charge — or "ask the seller" when she has set none — and free delivery above her threshold, stars and every review, **"More from this shop"** (her three newest other listings and a link to the whole shop), a **Report** link on the listing and on each review, and one **Add to cart** button. The seller card shows her shop, village, SMB ID and her rating across all her products, with **Report this shop**. Not built: gallery, variants, discount percentage, verified badge, distance, allergens, shelf life, delivery estimate before ordering, per-listing return policy, buy now, wishlist, **share to WhatsApp**, review photos, similar products.
- **[P0] Seller storefront** — `/shop/seller/:sellerId`: her card, delivery terms (charge or "ask the seller", free-above, minimum order) and every live product. Her story and policies are not on it. **It is the page a share-QR would land on** — but it needs a signed-in buyer, and the share-QR is not built (§5).
- **[P1] Wishlist · follow seller** *(not built)*
- **[P2]** Q&A on products, short-video feed *(not built)*

**What the public may see** *(built)*. One rule, `publiclyVisible()` in `catalog.routes.ts`, decides
both the catalogue list and a lookup by id: a `LIVE` product, an `ACTIVE` seller inside her term,
shop open. Anything else answers the same **404** as an id that never existed. A seller leaves the
API only as a **`PublicSeller`** — an allow-list of name, photo, shop, SMB ID, village, delivery
terms, pincodes, UPI ID and QR, and her rating derived from reviews; her phone reaches a buyer only
on their own order. **Play's demo account** (one number that is both a seller and a buyer, for the
store's reviewers) is kept apart: its shop is hidden from everyone but the demo buyer, and an order
between the demo account and a real one is refused in either direction (`backend/src/demo.ts`).

### 9.2 Categories

- **[P0]** Icon grid → subcategories → landing page with banner, subcategory chips, filters, featured items *(as built: a grid of tiles, each a photograph of the category (or an icon where no honest photo exists), opening a plain grid of its products. No subcategories, banners, chips, filters or featured items.)*
- **[P2]** Tiffin and subscription category, seasonal and festival collections *(not built)*

**As built — fourteen categories**, a constant in `backend/src/db/seed.ts` rather than a collection:
घरगुती खाद्यपदार्थ · लोणची, पापड, मसाले · मिठाई व बेकरी · शेव, भेळ, चिवडा · शेतीपूरक उत्पादने (food);
हस्तकला · भरतकाम · कापड व साड्या · शिवणकाम · अगरबत्ती व मेणबत्ती · दागिने · सौंदर्य व निगा · घर सजावट
(non-food); and **इतर** (Other), offered to both halves and sorted last — twelve categories cannot
name everything a village makes, and a woman whose product is not listed would otherwise file it
under something it is not. "Beauty & Personal care" is deliberately not "Wellness": a health name
invites the cure claims the terms forbid. The server refuses a category id that is not on the list.

**Suggested taxonomy** (the original plan)
- Homemade Food & Snacks · Pickles, Papad & Masala · Sweets & Bakery · Beverages
- Handicrafts · Handloom & Textiles · Sarees & Dress Material · Tailoring & Custom Stitching
- Jewellery & Accessories · Beauty & Wellness (soaps, oils, herbal)
- Home Decor · Puja & Festival Items · Plants & Gardening · Gifting & Stationery
- Farm & Agri Produce · Services (mehndi, catering, tiffin)

### 9.3 Cart & Checkout

- **[P0] Cart grouped by seller** — *(decided otherwise: **one seller per cart**, §1 decision 2.)* A product from another shop is refused on the product page: "तुमच्या टोपलीत {shop} यांच्या वस्तू आहेत. एका वेळी एकाच विक्रेतीकडून खरेदी करता येते. आधीची खरेदी पूर्ण करा किंवा टोपली रिकामी करा." with a button to the cart. Nothing is cleared on her behalf. The cart card still shows the seller, her delivery charge and her minimum order, and "More from this shop" below it. Each line gives the size of one pack beside its price ("500 ग्रॅम · ₹120") with the count on the stepper. Each order line copies the size at checkout, so the buyer's, the seller's and the admin's order screens say "500 ग्रॅम · 3 × ₹120".
- **[P0]** Quantity stepper — up to the stock (or 20 for made-to-order), down to zero, which removes the line. Save for later, price-change warnings *(not built)*.
- **[P0] Bill breakup** — item total, delivery fee, grand total. **A delivery charge of 0 means "ask the seller", never "free"**: no screen asks a seller for a charge (§8.1), so the line reads **विक्रेतीला विचारा**, the total reads **एकूण (डिलिव्हरीशिवाय)**, and **डिलिव्हरीबद्दल विचारा** reveals the seller's number with Call and WhatsApp buttons so the buyer can ask before ordering. "Free" appears only where the seller's own free-delivery minimum is met. Below the minimum order, checkout is disabled. Discount *(not built)*.
- **[P0] Address** — saved addresses, add new with landmark and pincode (voice input on the address and landmark), an optional label. **Serviceability**: outside Maharashtra the order is refused before the seller sees it; inside, a pincode outside the seller's list only warns. Map pin *(not built)*.
- **[P0] Payment step per seller** — choose Cash on delivery or UPI. *(As built: nothing is paid at checkout. UPI is paid on the order screen after the seller accepts — §4.)*
- **[P0] Order confirmation** — the order ID and "the seller has your order". **No delivery OTP** (§1, decision 6).
- **[P0] Track order** — as built: the items, the order number with a copy button, a one-line status that opens into the four-stage tracker, the seller's delivery estimate, the seller's shop and number with **Call** and **WhatsApp**, the pay card once accepted (§4), who ended the order and why, the refund owed, and her ratings. **Cancel** only while `PLACED`, in three steps (§2); after acceptance the screen says to call the seller. Chat and "report an issue" from the order *(not built — the complaints sheet in her profile covers it)*.
- **[P0] Order history** — My Orders, with three tabs: **चालू** (active), **पूर्ण झालेले** (completed), **रद्द झालेले** (cancelled). Reorder, invoice and receipt *(not built)*.
- **[P1]** Coupons; delivery time-slot preference and a note for the seller *(not built)*
- **[P1]** Rate and review after delivery *(built — below)*; return or replacement request with a photo; refund status *(not built; the order screen says when a refund is owed)*

**Rating what arrived** *(built; `shared/src/review.ts`)*. One review per **product** per delivered
order, stars required, words optional (up to 500), every star row printed with its number and a
word. **The buyer cannot skip it**: while any delivered order from the last 30 days is unrated, a
full-screen **मिळालेल्या वस्तूंना तारे द्या** covers the whole buyer app with no close button, and the
server refuses a new order until it is done. A review shows the buyer's first name only. A seller's
rating is her products' reviews taken together; buyers never rate her directly. An admin can hide a
review, with a reason, and that is the only moderation action.

### 9.4 My Profile

- **[P0]** Profile info, verified phone — her name (editable, voice input) and number. Email *(not built)*.
- **[P0]** My orders with tracking *(built)* and invoices *(not built)*
- **[P0]** Saved addresses — edit, make default, remove (with a confirmation), add
- **[P0]** Notification preferences *(not built)* and **language** *(built)*
- **[P0]** Help and support — a **Help card** *(built 27 September 2026)*, **आमच्याशी बोला**, with **व्हॉट्सॲपवर मदत**, **फोन करा** and **तक्रार नोंदवा**, the same complaints sheet as the seller's (§8.4). The screen walkthroughs can be replayed from here too.
- **[P0]** Terms, privacy *(the policies tile, §7)*, delete account *(built — §8.3)*, logout *(with a confirmation that her cart stays on the phone)*
- **[P1]** Wishlist, followed sellers, my reviews, coupons and credits *(not built)*
- **[P2]** "Become a seller" — upgrade this account. Refer and earn. *(not built; the same number can register as a seller from the landing page — §1, decision 1)*

**Registering a buyer.** A number with no name on record is signed in but not registered, and is
sent to `/register/customer` to give a name and tick the consent box (§7). A **blocked** number is
told so at sign-in — "हा नंबर बाजारात बंद केला आहे. मदतीसाठी बाजाराच्या कार्यालयाशी संपर्क करा." —
rather than that her code is wrong, and the same refusal stops an order (§10).

---

## 10. Admin — web console

The job statement: see the whole flow, and step in when something breaks.

As built (`admin/`, a separate Vite app, Marathi by default with an English switch): a sidebar of
Home · Today · Payments · Products · Sellers · Orders · Reviews · Complaints · Impact, with counts
on Payments, Products and Orders that refresh every minute. `npm run admin` drives the same routes
from a terminal.

- **[P0] Auth and roles** — email and password with 2FA; Super Admin, Ops, Support, Content, Finance; a full audit log of every admin action. *(As built: named accounts with scrypt-hashed passwords, 8-hour idle sessions, rate-limited sign-in. **One role**, no 2FA. No audit-log screen: each decision records who made it where it lands — `verifiedBy` on payments, `hiddenBy` on reviews, `resolvedBy` on complaints, `reviewedBy` on cleared reports, `blockedBy` on a blocked buyer, and an auth event for closes and buyer blocks. Who blocked a seller, granted slots or moderated a product is not recorded.)*
- **[P0] Payment approvals queue** — *the new highest-traffic admin screen.* Seller name, phone, amount, UTR, payment screenshot, payer UPI handle, submitted time, **duplicate-UTR flag**, and Approve / Reject with reason. *(Built, plus: PACK or RENEWAL, when she says she paid, **how long she has been waiting** (re-read every 30 minutes), the screenshot opened large beside the figures, and **three checks that must be ticked before Approve** (§3). Approving grants 5 slots for a pack, moves her term (§3) and notifies her in the app and by push — **no SMS**.)*
- **[P0] Record an outside payment** *(built 27 September 2026)* — on a seller's page: pack or renewal, cash / UPI / other, when, an optional UTR (required for UPI, and refused if already used) and a note. It is stored already approved and applied exactly as a queued approval, so a renewal moves her date. This is how the ₹50 is taken from APK sellers, who see no price (§3).
- **[P0] Admin payment accounts** — the bank details and UPI QR shown to sellers on the payment screen, editable here so you never redeploy to change an account number *(not built — `ADMIN_UPI_ID`, `ADMIN_UPI_NAME`, `ADMIN_BANK_NAME` in the server's environment; no account number or IFSC, because she pays by UPI and a wrong account number under a QR is worse than none)*
- **[P0] Plan management** — price and slot count per pack, so ₹50 / 5 can change without a code change *(not built — `PLAN` in `shared/src/seller.ts`)*
- **[P0] Dashboard** — GMV, orders today and this week, active sellers, new registrations, **pending payment approvals**, **pending product approvals**, **stuck orders and SLA breaches**, cancellations, open disputes, cash pending collection. *(As built: Home puts the three queues first — payments, products, stuck orders — then active sellers (shops a buyer can reach today), subscriptions ending this week and expired, new registrations, orders this week, earned this month, and how many database documents a server start reads; Today adds totals, first-earning, subscription income and two donut charts. Cancellations, open disputes and cash pending are not shown.)*
- **[P0] Seller management** — list and search, slot usage per seller, **manual slot grant**, subscription and payment history, KYC queue, document viewer, **FSSAI verification and expiry monitor**, **UPI verification**, block and unblock, audited view-as-seller. *(Built: search by name, shop, village, phone or SMB ID; filters for subscriptions ending, expired and reported shops; sort; slots, packs and readiness on every row; grant and revoke slots; **Record payment**; block and unblock with a reason; **close account** and restore (below). Her page shows identity, settings including her FSSAI number when she gave one, readiness, the decisions timeline, payment history with each resulting end date, listings, orders with the buyer masked, reviews and reports about her shop. KYC, documents, FSSAI verification and expiry, UPI verification and view-as-seller are not built.)*
- **[P0] Product moderation** — approval queue, approve or reject with reason, **block food listings without a valid FSSAI**, banned-item flags, bulk actions, takedown, category re-mapping. *(Built: tabs Pending · Live · Reported; **Publish** is the only way a listing goes live (§8.2); **reject or take down** requires a reason and **deletes the listing at once** with its photo and reports, freeing the slot; **clear reports** closes them with who looked. FSSAI check, banned-item flags, bulk actions and re-mapping are not built.)*
- **[P0] Order monitoring** — every order filtered by status, seller, date or pincode; full timeline and audit per order; **stuck-order alerts** including UPI payments the seller hasn't confirmed; force-cancel; nudge the seller. *(Built read-only: filter by status and pincode, sort, a "stuck" mark, and a detail panel with the buyer's name, phone and address, items, who ended it and why, and the last event. No date or seller filter in the screen, no full timeline, no force-cancel, no nudge.)*
- **[P0] Catalog config** — categories and subcategories, attributes, units, banners, homepage sections, featured placement *(not built — categories and units are constants in code)*
- **[P0] Content** — upload training videos and courses, FAQs, announcements, policy pages, **and the Marathi/English strings** *(not built — all of it lives in the repo)*
- **[P1] Share-QR analytics** — scans, installs and orders per shop code; bulk poster generation for a training batch *(not built; a seller's page prints a scan count nothing increments — §5)*
- **[P1] Customer management** — list, order history, block fraudulent accounts. *(As built: no buyer list and no buyer page. **Blocking** is built — below.)*
- **[P1] Dispute desk** — ticket queue with an SLA, assignment, internal notes, resolution; power to block a seller who won't refund. *(As built: the **Complaints** screen — open, resolved and all complaints with subject, who, their number to call, a link to a seller's page and **Resolve**, recording who. No SLA, assignment or notes. Blocking a seller is on her page.)*
- **[P1] Finance** — subscription revenue report, reconciliation against the bank statement, CSV export *(partly: subscription income summed from approved payments on Today; no reconciliation or export)*
- **[P1] Marketing** — coupons, campaigns, push composer with audience segments *(not built)*
- **[P1] Reports** — sales by category, seller and region; seller leaderboard; funnel; retention; average delivery time; cancellation reasons; slot utilisation *(partly: the **Impact** screen — §13.2)*
- **[P1] System** — staff and roles, app config, feature flags, maintenance mode, notification templates *(not built; admin accounts are managed with `npm run admin:users`)*

**Reviews [P0]** *(built)* — every review with filters for low ratings, hidden and reported; **Hide**
with a required reason (the only action — a hidden review leaves the product's list and average,
and the buyer sees it was hidden) and **clear reports**.

**Reports [P0]** *(built September 2026; `shared/src/report.ts`)* — the in-app reporting Google Play
requires of an app carrying what its users write, and the only moderation signal that arrives after
a listing is live.

- **Four things can be reported, each with its own reasons**: a **listing** and a **shop** by a buyer; a **review** by a buyer or by the seller it is about; a **buyer** by a seller, and only from an order between them (the report keeps the order). A reason is always required, from the list; only "other" needs typed words. One report per person per thing — a second tap is answered as if it were the first.
- **A report changes nothing on its own.** The listing stays live; one annoyed buyer must not be able to empty a woman's shop. Reports are anonymous to the seller.
- They land in the console: reported listings in Products' **Reported** tab, reported reviews in Reviews, reported shops as a filter on Sellers and on her page, reported buyers on the Complaints screen, grouped by buyer. Each has a way to act (take down, hide, block) and a way to **clear** — closed with who looked, not deleted, because "three people complained and an admin disagreed" is a different fact from "nobody complained".

**Blocking a buyer [P1]** *(built)* — from the reported-buyers card, or by typed number: a reason is
required and kept, every session on that number ends, and sign-in and ordering refuse it with a
message that names no reason. **Blocking is not closing**: a closed account is rebuilt the next time
she signs in; a block survives a close.

**Closing an account for somebody [P0]** *(built 26 September 2026)* — for the lost phone or the code
that never arrives. A red **Close account** beside Block on a seller's page, undone by **Restore**
inside her seven days; a card on the Complaints screen for a buyer, by number. Staff record how the
request came (phone, WhatsApp or email), tick that they **rang the registered number back** and she
confirmed, and for a seller type her last four digits. The effect is exactly her own button's (§8.3).

---

## 11. Data model sketch

> **As built.** The model that shipped is `shared/src/types.ts`, stored as eleven Firestore
> collections — `sellers`, `products`, `orders`, `payments`, `customers`, `reviews`, `reports`,
> `complaints`, `sessions`, `admins`, `authEvents` — or one JSON file in development, loaded whole
> into memory at boot (`backend/src/db/store.ts`). It is flatter than the sketch below: the shop
> lives on the `Seller` record; addresses are embedded in the `Customer`; an order copies its items
> (name, price, quantity) and carries its own `events` list instead of an `order_status_events`
> table; there are no plans, subscriptions, variants, inventory, media, carts, wishlists or
> notifications tables — the plan is a constant, the term is one date on the seller, the cart lives
> on the phone, and the updates list is derived. Categories are a constant in code. The sketch is
> kept as the original design.

New tables for the subscription, seller UPI and share-QR requirements are marked `←`.

```
users(id, phone, name, email, roles[], language, status)
seller_profiles(user_id, business_type, udyam_no, gstin, group_name, village, taluka,
                kyc_status, account_status, upi_id, upi_qr_url, upi_verified)          ←
shops(seller_id, name, slug, logo, cover, about, is_open, hours, min_order, delivery_fee,
      free_delivery_above, prep_time, pincodes[], return_policy,
      share_code, share_qr_url, poster_url)                                            ←

plans(id, name, price, product_slots, validity_days)                                   ←
subscriptions(id, seller_id, plan_id, slots_granted, status, activated_at, expires_at)  ←
subscription_payments(id, seller_id, subscription_id, amount, method, utr_reference,
                      screenshot_url, payer_upi, payer_name, status, submitted_at,
                      verified_by, verified_at, reject_reason)                          ←
admin_payment_accounts(id, label, bank_name, account_no, ifsc, upi_id, qr_url, is_active) ←
share_link_events(id, shop_id, event_type, referrer, device_hash, at)                  ←

categories(id, parent_id, name_i18n, icon, sort_order)
products(id, shop_id, name_i18n, category_id, description, is_edible, status, unit,
         mrp, price, min_qty, max_qty, is_made_to_order, returnable, occupies_slot)     ←
product_variants(product_id, label, price, stock)
product_media(product_id, url, sort_order, is_cover)
food_details(product_id, fssai_number, fssai_expiry, fssai_cert_url, veg_mark,
             ingredients, allergens, net_weight, shelf_life, storage)
inventory(product_id, variant_id, stock, low_stock_threshold)

addresses(user_id, label, line1, landmark, pincode, lat, lng, is_default)
carts / cart_items(cart_id, product_id, variant_id, qty)
order_groups(id, customer_id, total, placed_at)
orders(id, group_id, shop_id, customer_id, address_snapshot, items_total, delivery_fee,
       total, payment_mode, payment_status, payment_utr, payment_screenshot_url,        ←
       payment_confirmed_at, status, delivery_otp, accepted_at, dispatched_at,
       delivered_at, cancel_reason, source_share_code)                                  ←
order_items(order_id, product_snapshot, qty, price)
order_status_events(order_id, from_state, to_state, actor_id, actor_role, note, at)

reviews(order_id, product_id, shop_id, rating, text, media[])
wishlists · coupons · tickets · disputes · notifications
training_courses / lessons / enrollments
banners · audit_logs · app_config · translations                                        ←
```

`slots_used` is derived — the count of her products whose status is `PENDING`, `LIVE` or `PAUSED`
(`SLOT_CONSUMING` in `shared/src/seller.ts`) — not stored, so it can never drift out of sync with
reality.

---

## 12. Non-functional requirements

- **Mobile-first, then wrappable** — build the UI at phone width; the admin console is the only desktop layout. Keep it all inside a PWA-capable single-page app so it can be wrapped into an APK without a rewrite — which is how it shipped: a React Native WebView loading the deployed site (`docs/DEPLOY.md` §6). The wrapper is also what makes App Links and the Install Referrer API available (neither is built yet). The APK needs the network to open at all; a Vercel deploy of `frontend/` is an APK update.
- **Rural usability** — see §6. It is a requirement, not a preference.
- **Performance** — first paint under about three seconds on 4G, compressed images, paginated lists, virtualised long lists. Budget for a ₹8,000 Android phone, not a flagship. *(As built: compressed photos loaded lazily as thumbnails, no web fonts, and a screen cache so Back paints at once. Lists are not paginated or virtualised; the API answers from memory, and a catalogue is sent whole.)*
- **Security** — OTP rate limiting, role checks on every endpoint, KYC documents and payment screenshots in a **private** bucket behind signed URLs, PII encrypted at rest, phone numbers masked between parties, a full admin audit trail on every approve and reject. *(As built: OTP and sign-in rate limits keyed by number and IP; role checks on every route; revocable server-side sessions; a public allow-list for what anyone may see of a seller; Firebase only on the server, with client access denied by the rules; photo URLs accepted only from this app's own upload folders. Not built: private signed-URL storage (payment screenshots are in Cloudinary under unguessable public URLs), app-level PII encryption, masked numbers (§2 says why), and a full audit trail (§10). There is no KYC.)*
- **Compliance** — FSSAI number on every food listing, expired licences auto-hidden, seller agreement accepted at registration, return and refund policy published, and an explicit disclosure that order payments go directly to the seller. *(As built: the seller agreement, terms, privacy, refunds and grievance pages are published and **accepted with a recorded version** (§7), the payment disclosure is in them, and accounts can be deleted in the app and from `/delete-account` (§8.3). FSSAI is optional by decision (§8.2); there is no expiry, so nothing is auto-hidden.)*
- **Accessibility** — 44px minimum touch targets, readable contrast, scalable text, and audio help *(not built)*.
- **Durability** *(added)* — one server process holding the whole dataset in memory, writing diffed batches to Firestore; a persist that would delete more than half a collection is refused; a nightly backup copies Firestore and the photos to separate accounts and reads the copy back (`docs/BACKUP.md`).

---

## 13. Growth charts — hers and the platform's

Two audiences that need opposite treatments. Hers exists to **motivate**; admin's exists to
**operate and to report impact**.

> **Start capturing the events in Phase 0, even though the charts ship in Phase 6.** Analytics
> cannot be backfilled. If event logging is added six months after launch, the first six months
> of the platform's growth story simply doesn't exist — which for a programme that will have to
> prove impact to a funder or a government department is an expensive thing to lose.

### 13.1 Her growth **[P1]**

Eight rules, and they matter more than the chart types:

1. **Never compare her to other sellers.** Only to her own past. A leaderboard demotivates the majority who aren't near the top, and it leaks other women's earnings.
2. **The number comes first, the chart second.** Big number, arrow, word — the chart supports it.
3. **Bars, not lines.** Bars are far more legible to someone who has never read a chart.
4. **No axis, no gridlines, no legend.** Label every bar with its rupee value directly. She should never have to read a scale to know what a bar means.
5. **At most 7 bars** — 7 days or 6 months. Never more.
6. **Colour plus arrow plus word**, never colour alone: an up or down arrow, the difference in rupees, and the word for more or less.
7. **Audio.** A speaker button reads the summary aloud in Marathi — same rule as everywhere else in the app. *(not built)*
8. **The empty state matters more than the chart.** With two orders, a chart is noise.

**As built** — the Growth screen, `/seller/growth`, reached from a tile on My Business. Rules 1–6
and 8 hold; the cards are:

| Card | Form | What it shows |
|---|---|---|
| कमाई — earnings | Big number + 7 labelled bars | *(as built: **this week**, day by day, versus last week, with the difference in rupees — not the month)* |
| ऑर्डर — orders | Big number | Order count this week versus last week |
| सर्वात जास्त विकलेले — top products | Horizontal bars with product photos, top 5 | Which product actually earns her the most. The most **actionable** thing she will ever see. *(not built)* |
| किती लोकांनी पाहिले — views to orders | Two numbers, not a chart | *(as built: her products' lifetime views, then her delivered orders. **Nothing increments a product's views yet**, so the first number stays at 0 for a real seller.)* |
| परत आलेले ग्राहक — repeat customers | Single number | Buyers who came back — counted over everything she has sold, not this month |
| तुमच्या QR मधून — from her QR | Three numbers | scans → installs → orders *(not built — §5)* |

Beyond the charts:

- **[P1] Milestone cards** — *तुमचे 100 वे ऑर्डर!* A celebration beats a chart for motivation. *(not built)*
- **[P1] Shareable monthly summary image** — *या महिन्यात मी ₹4,200 कमावले*, one tap to WhatsApp. Motivation and free marketing in the same feature. Probably the highest-return item in this section. *(not built; the growth screen's Share button was removed on 26 September 2026)*
- **[P2] Plain-language suggestions** drawn from her own data: *शनिवारी सर्वात जास्त ऑर्डर येतात* · *लोणच्याला जास्त मागणी आहे*. *(not built)*

**Empty and low-data states:**

| Her data | What she sees |
|---|---|
| 0 orders | No chart at all. As built: *अजून माहिती कमी आहे* — *पहिले ऑर्डर आल्यावर तुमचा आलेख इथे दिसेल* (no training link — there are no training videos yet). "0" means no **delivered** order ever. |
| 1–4 orders | The numbers only, no chart. A 3-bar chart looks broken and reads as failure. *(Dropped: from the first delivered order she gets the full screen.)* |
| 5+ orders | Full treatment. |

### 13.2 Admin dashboards **[P1]**

Desktop, data-literate audience, so full dashboard treatment. Four boards.

> **As built, 28 September 2026:** none of the four boards exists as specified — no time series,
> no funnel, no exports. What exists: **Home** and **Today** (§10, *Dashboard*) with the queue
> counts, active sellers, subscriptions ending and expired, new registrations, orders today and this
> week, earned this month and in total, **women with a first earning**, subscription income, and two
> donut charts — the **earnings distribution** in the four bands of board C, and digital-readiness
> bands; and **Impact**, with the women registered, active and earning, total earned, orders and
> villages, a by-village table, and a button that copies it all as plain text for a report. The
> server also computes a repurchase rate and a 30-day GMV that no screen shows.

**A · Usage and adoption**
- **Registration funnel** — registered → paid ₹50 → approved → first product published → first order received. **The single most important chart in the admin panel:** it shows exactly which step women fall out of, and every one of those steps is fixable.
- New registrations over time · active sellers (listed or fulfilled in the last 30 days) versus total registered
- DAU / WAU / MAU, split seller versus customer
- App installs attributed to share QRs · session and screen usage

**B · Selling**
- GMV over time, daily / weekly / monthly
- Order volume and average order value
- **Order status funnel with drop-off %** — placed → accepted → delivered
- Sales by category · sales by district and taluka *(map [P2])* — geographic spread matters for a rural programme
- COD versus UPI split
- Cancellation and rejection rate over time, broken down by reason
- Delivery-time distribution — hours from ACCEPTED to DELIVERED

**C · Money raised by the women** — the impact board
- **Cumulative total earned by all women.** The headline number for the whole platform.
- **Earnings distribution histogram** — how many women earned ₹0, under ₹1,000, ₹1,000–5,000, over ₹5,000. This is the honest chart: it distinguishes helping many women a little from helping a few women a lot, which a total alone hides completely.
- **First-earning conversion** — the share of registered women who have earned at least ₹1. The most truthful single measure of whether the app works.
- **Median** monthly earnings per active seller — median, not mean, because a few high earners will distort the mean badly at this scale
- Earnings by district · month-on-month growth
- Top earners — internal only, never surfaced in the app

**D · Platform revenue and operations**
- ₹50 subscriptions collected over time
- **Slot-pack repurchase rate** — how many women bought a second pack. The clearest signal of whether the business model works at all.
- Pending versus approved payments, and **approval queue age** — how long women are waiting. That's an SLA on somebody's livelihood, so alert on it.
- Product approval queue age · stuck orders · open disputes and resolution time

**[P1] Impact report export.** A programme like this will have to show a funder, an NGO board or a government department: *N women, ₹X earned, Y districts.* Give admin a one-click monthly PDF and CSV. Built once, it saves assembling the same numbers by hand every month forever. *(Partly: the Impact screen's copy-as-text button. No PDF or CSV.)*

### 13.3 Chart standards

- **Never a dual-axis chart.** Two measures at different scales become two charts, not two y-axes.
- Sequential scales are one hue, light to dark. Diverging scales are two hues with a neutral grey midpoint. Never a rainbow.
- Categorical hues are assigned in a fixed order and never cycled; colour follows the entity, so filtering a series out must not repaint the survivors.
- Two or more series always carry a legend, and up to four are also directly labelled — identity is never colour alone.
- Every chart gets a date-range picker, compare-to-previous-period, and CSV export.
- **Validated categorical palette** (passes lightness band, chroma floor, CVD separation, normal-vision floor and contrast in both themes — use this order):

| Slot | Light | Dark |
|---|---|---|
| 1 | `#3D5AC4` | `#6E86E0` |
| 2 | `#B31A5B` | `#D4568C` |
| 3 | `#C07C10` | `#B8862F` |
| 4 | `#00897A` | `#1F9C88` |

### 13.4 Data these charts require

Most of it already exists in the schema. What has to be added now — with where each stands on
28 September 2026:

| Source | Feeds |
|---|---|
| `order_status_events` *(exists — as each order's own `events` list)* | order funnel, delivery times, stuck orders |
| `orders` where `COMPLETED` *(exists — as `DELIVERED`, now the last state)* | all earnings and GMV figures |
| `subscription_payments` *(exists — the `payments` collection, with `submittedAt` and `verifiedAt`)* | platform revenue, repurchase rate, approval queue age |
| `share_link_events` *(not built — only running `qrScans` / `qrOrders` counters on the seller, and nothing calls the scan route)* | QR scans, installs, attributed orders |
| **`app_events(user_id, role, event, screen, at)`** ← new *(not built)* | DAU/WAU/MAU, screen usage, funnel steps |
| **`product_views(product_id, viewer_hash, at)`** ← new *(not built — a `views` counter exists on each product, and nothing increments it)* | views-to-orders, her "how many people looked" card |

The warning at the top of this section still applies, and is now overdue: the two event tables
were never started, so the growth story before they are is already lost.

---

## 14. Build order

| Phase | Contents | Status, 28 September 2026 |
|---|---|---|
| **0 — Skeleton** | Routing and role-based shells, every screen with real layout and mock data, the order state machine, **the subscription/slot state machine**, Marathi + English i18n scaffolding, and the design system built to §6's rules | Done |
| **1 — Seller core** | Auth, registration with the ₹50 payment step, product upload wizard with the FSSAI branch and slot gate, my products, order actions, delivery OTP | Done, except the delivery OTP (dropped, §1) and FSSAI in the wizard (asked at registration instead, §8.2) |
| **2 — Customer core** | Explore, categories, product detail, seller storefront, cart split by seller, per-seller UPI checkout, order tracking | Done, with one seller per cart and UPI paid after acceptance |
| **3 — Admin** | Payment approvals, seller and product moderation, order monitoring, catalog config | Done except catalog config; plus reviews, reports, complaints, buyer blocks, account closing and outside payments |
| **4 — Real backend** | Replace mocks; notifications, reviews, disputes, share-QR generation and tracking | Done: Firestore, push and the updates list, reviews, reports and complaints. Disputes and share-QR not built |
| **5 — App wrapper** | React Native WebView APK (built), Android App Links, Play Install Referrer deep linking, Play Store listing | APK built with push; Play Store listing in preparation (`docs/PLAY-STORE.md`, `docs/PLAY-READINESS-REVIEW.md`) — policies, consent, account deletion, reporting, the demo account and the price-free APK were done for it. App Links and Install Referrer not built |
| **6 — Growth charts** | Her earnings and orders cards, top products, milestones, shareable monthly summary; the four admin boards and the impact export | Partly: her earnings, orders, repeat-buyer and views cards; admin Home, Today and Impact (§13) |
| **7 — Polish** | Training content and audio help, offers, earnings reports | Not started; the screen walkthroughs stand in for training |

**One thing from Phase 6 has to happen in Phase 0:** writing `app_events` and `product_views`.
The charts can wait; the data they read cannot be created retroactively.

---

## Sources

- [FSSAI registration process and the 14-digit number — ClearTax](https://cleartax.in/s/fssai-registration)
- [FSSAI food licence for e-commerce — ClearTax](https://cleartax.in/s/e-commerce-fssai-food-license-registration)
- [FSSAI direction on e-commerce food business operators (2024)](https://fssai.gov.in/upload/advisories/2024/07/669a5e5daca83direction%20merged.pdf)
- [Food safety compliance for e-commerce FBOs — CliniExperts](https://cliniexperts.com/regulatory-update/food-safety-compliance-for-e-commerce-fbos/)
- [Firebase Dynamic Links shutdown and migration — Branch](https://www.branch.io/guides/how-to-migrate-from-firebase-dynamic-links/)
- [Deferred deep linking after the FDL shutdown — MessageFlow](https://messageflow.com/blog/deferred-deep-linking/)
