# Presentation script: every feature, on one laptop

For the presenter running a training-cum-presentation for teachers and
students on a projector or smart screen. Seller, customer and admin are all
run from one laptop. Checked against the code on `prathamesh2` on
28 September 2026.

The script follows one story from start to finish: a woman joins, sets up her
shop, gets approved, receives orders and gets paid. Each feature appears at
the moment it matters in that story.

---

## 0. Setup that will break the demo if skipped

### Seller and customer must NOT be in the same browser window

- [ ] The seller app deliberately **keeps all its tabs signed in as the same
      person** (`frontend/src/store/AuthContext.tsx`, the `storage` listener).
      If you log in as the customer in a second tab, **the seller tab silently
      becomes the customer too.**
- [ ] Use **two separate browser profiles**: Chrome profile "Seller" and
      Chrome profile "Customer". A normal window plus an Incognito window, or
      Chrome plus Edge, also works.
- [ ] The admin console is a different website, so it can sit in either window.
- [ ] Suggested layout: **seller on the left half of the screen, customer on
      the right half**, admin in a tab behind the seller. For every order
      step, the audience sees the action on one side and the result on the
      other.

### Make it look like a phone
- [ ] The app is designed for a phone. In each window open DevTools (F12),
      turn on the device toolbar (Ctrl+Shift+M) and pick a phone about 400px
      wide, **or** just narrow the window to half the screen.
- [ ] Zoom to 125–150% so the back row can read it. Test from the back of the
      room beforehand.
- [ ] Hide the bookmarks bar and close unrelated tabs. Turn off notifications
      on the laptop.

### Phones and numbers
- [ ] **Two real phone numbers, with the phones in the room**: one for the
      seller, one for the customer. The login code arrives by real SMS.
- [ ] If you are going to show **registration live**, both numbers must be
      **new** (never registered). Rehearse with *other* numbers.
- [ ] **Only 3 codes per number per 24 hours.** Don't rehearse on the demo
      numbers on the morning of the presentation.
- [ ] Keep one **backup seller number** and one **backup customer number**.
- [ ] **Do not use the Play reviewers' demo number** (`backend/src/demo.ts`,
      `docs/PLAY-READINESS-REVIEW.md`), even though it needs no SMS. Its shop
      is hidden from every other account, and the server refuses any order
      between it and a real account, so it cannot show the real flow.
- [ ] An account that has not yet agreed to the current policies (version
      of 27 September 2026) is stopped **once** by a full-screen "The
      market's rules" notice. A brand-new registration agrees on its last
      screen and never sees it. If you use existing numbers, sign them in at
      the rehearsal and tap through it, or plan to show it (section 10).
- [ ] If the customer number has a **delivered order it has not rated**, the
      rating screen will cover the whole buyer app the moment you sign in.
      Rate everything at the rehearsal.
- [ ] The seller's phone needs a **real UPI app** with a real UPI ID (a
      trainer's). The customer's phone needs a UPI app with a little money,
      so you can make a real payment.

### Money you will actually move (keep it small)
- [ ] Set the demo products' price at **₹10–₹20**, so the buyer→seller UPI
      payment is real but cheap.
- [ ] Decide how the seller will get her 5 slots:
      - **Pay ₹50 for real** to the college UPI from the website and approve
        it in admin. This shows the full proof-and-checks flow and is
        recommended.
      - **Or** take the ₹50 in cash and use admin **Record payment**. This
        is how every seller using the Android app pays, because the app
        shows no price and no pay screen (section 3).
      - **Or** use admin **Grant slots**. This is fastest but skips payment
        altogether.

### Accounts and data
- [ ] An admin account works in the admin console (`npm run admin:users -- list`).
- [ ] Have a **ready photo of a product** on the laptop (and one bad, dark
      photo, used to show a rejection), plus a **screenshot of a UPI success
      screen** for the ₹50 proof. It must be on the laptop, because the
      upload happens from the laptop browser.
- [ ] At least **one other real live seller** exists in the catalogue (used
      to show "one shop per cart").
- [ ] This is the **live production site**. Anything you approve is visible
      to real buyers until the cleanup in section 12.
- [ ] **No deploys** on the day of the presentation.
- [ ] **Optional, to show phone notifications:** the seller's phone with the
      latest APK, signed in as the seller and with notifications allowed.
      Notifications reach only the APK, never the laptop browser. Signing in
      there spends one of that number's 3 codes for the day.

### A fallback in case the network fails
- [ ] Screenshots or a screen recording of the full flow, taken at the rehearsal.

---

## 1. Introduction (10 min)

- [ ] What the market is, who it is for, and why it is named after
      कै. शांताबाई (काकी) सिद्रामप्पा आलुरे (the logo)
- [ ] **Three apps, one system**: the seller's app, the buyer's app (the same
      app, a different role) and the admin console
- [ ] **The Android app** is the same website inside an app wrapper. Show the
      APK on a phone if you have it. Two differences worth naming: it is the
      only place **phone notifications** arrive, and it never shows the ₹50
      or a pay screen (section 3).
- [ ] Design principles, worth saying aloud because they explain what the
      audience will see:
  - [ ] **Marathi first**, English available
  - [ ] Large text and large buttons. Every status has **colour + icon + word**.
  - [ ] Four bottom tabs, no hidden menus
  - [ ] **Voice input** (a mic) next to text boxes, with the keyboard always
        still available
  - [ ] Forms ask **one question per screen**
- [ ] **Landing page**: photo strip, "I want to sell" and "I want to buy",
      language choice, and in the footer **Policies and terms**, the privacy
      policy and **Delete your account** (public pages, no sign-in needed;
      Google Play requires them)

---

## 2. Seller registration: seller window (20 min)

- [ ] Landing → **I want to sell** → phone number → **OTP by SMS**
- [ ] Explain the security: a real code, single use, limited tries, 3 codes a day
- [ ] The **6-screen wizard**, with the progress dots and "Step X of 6":
  1. [ ] **About you**: name, age, education. Show the **mic** here and
         dictate the name.
  2. [ ] **Village and address**: village from the list, pincode
  3. [ ] **Your business**: shop name, type, **do you sell food?** This
         decides the categories and fields she sees later. A food seller is
         also offered an **FSSAI number** box: optional, but if typed it must
         be 14 digits. Admins see it on her page.
  4. [ ] **Digital use**: self-reported readiness. This is the "before"
         picture for the Digital Readiness Index.
  5. [ ] **Where your money arrives**: UPI ID, and optionally a photo of her
         bank's payment QR
     - [ ] **Show the typo check**: type `name@ybll` and the app asks
           "Did you mean @ybl?"
     - [ ] Explain why: a wrong UPI ID sends the buyer's money to a stranger
  6. [ ] **Check**: every answer, with **Change** jumping back to that screen
     - [ ] **The consent tick** at the bottom: links to the seller agreement,
           terms, privacy policy and refunds policy, then one box: "I have
           read and agree to the agreement, terms and policies above, and I
           am 18 or older". **Complete registration** stays disabled until it
           is ticked, and the server refuses a registration without it.
- [ ] **Draft is saved**: go back or refresh halfway through and the answers
      are still there
- [ ] Done → the **SMB ID** (`SMB-<VILLAGE>-<NN>`) and her digital score.
      The number counts per village, so a field coordinator knows where to
      go. On the website the next button is "Pay 50 rupees"; in the Android
      app it is just "Next", with a line saying the office will switch her
      shop on.
- [ ] The **walkthrough**: the first time each tab opens, it explains itself

---

## 3. Seller home and the ₹50 subscription (15 min)

### Seller home (My business)
- [ ] Shop **open/closed** switch. Closing hides the whole shop from buyers.
- [ ] Slots used / available
- [ ] "Needs your action" list
- [ ] Links to products, orders, buyers, reviews, growth

### The subscription
- [ ] Rule: **₹50 = 5 product slots, valid 6 months**, with no commission on
      sales. One end date covers the whole shop: a ₹50 renewal moves it six
      months on, while a second ₹50 pack mid-term adds 5 slots and leaves
      the date alone.
- [ ] Open the payment screen (**Registration fee**) on the website:
  - [ ] The **amount in large figures** (₹50) above the QR. She cannot read
        a QR, so the amount is printed too.
  - [ ] **QR code** and the written steps under it. A phone cannot scan its
        own screen, so step 1 is **take a screenshot** (power + volume-down),
        then open PhonePe or Google Pay, scan, tap the **gallery icon** and
        pick the screenshot. There is no "Save QR" button any more, and no
        "Pay" button: UPI apps decline a payment another app starts to a
        personal UPI ID.
  - [ ] **Paying to**: the payee name as printed on the poster, to check
        against what her UPI app shows
  - [ ] **UPI ID with a copy button** (the other route: paste it into the
        UPI app)
- [ ] Pay the ₹50 from the seller's phone (or skip to Record payment / Grant
      slots)
- [ ] Fill in the proof:
  - [ ] **Screenshot** of the success screen (required)
  - [ ] **Date and time paid**: try a future time and it is refused
  - [ ] **UTR**: type 11 digits and the button stays **disabled**. At
        exactly 12 digits it turns on.
- [ ] Submit → the **waiting** screen

### Admin window
- [ ] Sign in to the admin console
- [ ] **Home / Today**: counts of what is waiting
- [ ] **Payments**: the screenshot inline, open it large beside the UTR,
      time and amount, **how long she has been waiting**, and whether it is
      a **New pack** or a **Renewal**. A UTR already used on another payment
      is flagged "Same UTR again".
- [ ] **Approve stays disabled until all three checks are ticked**: UTR
      matches, time matches, money on the statement. Tick them one at a time
      on screen.
- [ ] Approve → back in the seller window, refresh: **5 slots** and an end date
- [ ] Mention **Reject** (always allowed, no checklist) and the
      **7-day renewal reminder**, then the "paused" state: her products
      disappear for buyers but nothing is deleted. A flat ₹50 renewal brings
      everything back exactly as it was, and paying in the reminder week
      loses no days.

### Inside the Android app there is no ₹50 at all
- [ ] Google Play forbids selling slots or time except through its own
      billing, and forbids pointing to another way to pay. So inside the APK
      the seller's screen is **My registration**: whether her shop is on,
      slots in use, and until when. No price, no QR, no form. Every notice
      and button that names the ₹50 has a price-free twin there.
- [ ] She pays the **desk or a field coordinator** (cash, or UPI to the
      college). Staff open her page in the admin console and press
      **Record payment**: New pack or Renewal, paid by Cash / UPI to the
      college (UTR required) / Other, date, note. It counts as approved at
      once, so make sure the money has arrived first.
- [ ] Show it now if you took the ₹50 in cash, or just point at the button.
      The website keeps its own pay screen and queue unchanged.

---

## 4. Adding a product and admin checking (20 min)

### Seller window: New product wizard
- [ ] Walkthrough ring on the progress dots
- [ ] **Photo**: from the gallery only, one photo. The app **compresses it on
      the device** (mention it saves mobile data). Remove it with ✕ and
      choose again.
- [ ] Seven screens, in this order: photo → **name** (use the **mic**) →
      **is it food?** → category and details → price → stock → preview
- [ ] Category, with **"Other"** as the escape hatch when nothing fits
- [ ] Food product: **ingredients** and **veg/non-veg** (the green/red
      square mark as printed on food packets). A non-food product asks for
      material instead.
- [ ] Price screen: price, MRP (optional), unit, and **the size**: "How much
      is one?" (e.g. 500 g). With the unit **set**, it also asks "How many
      in one set?" (a set of 6 ladoos). A price with no size cannot be
      compared with the next shop, so both are required.
- [ ] Stock, or **made to order**
- [ ] **Draft**: leave the wizard halfway, e.g. to change the language from
      Profile, and come back to find the work still there. **Finish later**
      saves a draft, which uses no slot.
- [ ] The final button says **"Send for checking"**, not "Publish", with a
      line above it saying an admin checks it first. Explain why: a photo, a
      price and a food claim go out under the market's name.
  - [ ] Heads-up: the green box on the preview screen still reads "Goes live
        straight away". It does not; that line is out of date in the app.
        Say so before someone asks.
- [ ] Send **two** products: one good, and one with the dark photo. The slot
      is spent the moment she sends it.

### Admin window: Products
- [ ] **To review** tab
- [ ] **Reject** the dark-photo one **with a reason**, which is required. The
      screen warns that rejecting **removes the product straight away**:
      the listing and its photo are deleted, her slot is freed, and she is
      told the reason.
- [ ] **Publish** the good one

### Seller window
- [ ] The rejected product is **gone from My products**, and **the slot is
      free again**. The reason is in the **Updates** list (bell).
- [ ] The approved product is **LIVE**
- [ ] The **Updates** list (bell) shows both decisions

---

## 5. Everything else in the seller app (15 min)

- [ ] **My products**:
  - [ ] Status pills (pending / live / paused / draft). There is no
        "rejected" any more: a rejected listing is deleted.
  - [ ] **Pause / Resume** a live product
  - [ ] **No delete button on a submitted product**. Only drafts can be
        deleted. Explain: otherwise one pack becomes unlimited products. A
        seller who regrets a listing asks an admin to take it down, which
        gives the slot back.
- [ ] **Edit product**: one page, not a wizard
  - [ ] **Price and stock: change as often as you like**
  - [ ] **Name, photo, category, size and similar: only 2 edits** on a live
        product. Show the "edits left" count and the field turning disabled
        once used up. Whether it is food cannot be changed at all.
- [ ] **Profile**: edit profile, payment QR / UPI, **language switch**
      (switch to English and back), subscription, **Policies and terms**
- [ ] **Delete my account**, the quiet line in its own card at the very
      bottom of Profile, far from Log out. Open it and walk the screens
      without finishing: what it costs (her listings, and the ₹50 is not
      returned) → a reason from the list → **the last 4 digits of her own
      number**. A seller with an order still in progress is refused and
      shown the orders. If she does finish: the shop closes at once, and
      she has **7 days** to sign in and press "Reopen my account" before
      everything about her is erased. Do not finish it on the demo seller
      until the cleanup (section 12).
- [ ] **Help & Training**: replay any walkthrough; **Help on WhatsApp** and
      **Call us** (the college office); **Raise a complaint** (pick a
      subject, write what happened; it lands on the admin **Complaints**
      screen); common questions; and a card on what to do when phone
      notifications do not arrive
- [ ] **Growth** screen (Digital Readiness): self-reported factors plus the
      ones **measured by the platform**
- [ ] **My buyers**, **Reviews** (both empty for now; come back after the
      orders)

---

## 6. Customer registration and shopping: customer window (20 min)

- [ ] Landing → **I want to buy** → OTP → **name** (a buyer without a name is
      sent to register) and the same **consent tick**, "…and I am 18 or
      older"
- [ ] **Explore / Home**, **Categories** → one category
- [ ] **Pincode bar**: enter a pincode. Outside the seller's area the app
      **warns but does not block**.
- [ ] **Product page**: photo (or a category photo if none), price and
      **size** ("500 g", "1 set (6 pieces)"), veg mark, ingredients, seller
      card (name, village, rating across all her products), reviews,
      **"More from this shop"**
- [ ] **Reporting**: a quiet **Report** link at the foot of the product, on
      each review, and **Report this shop** on the seller card. A reason is
      picked from a list; the seller is not told who reported. A report
      changes nothing by itself: it goes to the admin (section 9).
- [ ] **Seller's shop page** (`/shop/seller/…`): the whole shop window
- [ ] **One shop per cart**: add the demo product, then try a product from
      *another* seller. It is **refused**, naming the shop that holds the
      cart, with a button to go and look at it. Nothing is cleared for you.
- [ ] **Cart**: + / − quantity (stops at stock), 0 removes the line
- [ ] **Delivery charge "ask the seller"**: when the seller set none, the
      total says "without delivery". It never falsely says "free". The cart
      offers **Ask about delivery**: a tap shows the seller's number with
      **Call** and **WhatsApp** buttons.
- [ ] Mention that closing a shop or blocking a seller hides all their
      products, and a hidden product's link shows "not found"

---

## 7. Order 1: the full UPI life cycle (25 min, side by side)

| Customer (right) | Seller (left) |
|---|---|
| Checkout: address, **UPI**, place order. The screen says "you pay only after she accepts". | |
| Order screen: 4-stage tracker, order number with copy, status box | |
| | Bell / Orders: **new order** (refresh the laptop; on the seller's phone with the APK, a **phone notification** arrives) |
| | Order detail: items, buyer's phone, area note. **Accept order** |
| | Accept opens **"How soon can you deliver?"**: chips Today / Tomorrow / In 2 days / In 3 days, the mic, or **Accept without saying** |
| The order now shows **Expected delivery** in her words. **Now** the pay section appears: **amount in large figures**, QR, screenshot steps, UPI ID copy | |
| Pay ₹10–20 from the customer's phone, enter the **12-digit UTR** | |
| | "Buyer says paid" (**a claim, not money**; the APK phone buzzes again). Check the seller's own UPI app → **Yes, money received** |
| | Point out that **"Ready to send" appeared only after confirming payment** |
| Tracker: **Shipped** | **Ready to send** |
| Tracker: **Out for delivery** | **Out for delivery** |
| Tracker: **Delivered** | **Delivered** |
| **"Rate what you received" covers the whole app**, with no close button | |
| Show that nothing else works, not even the tabs, until it is rated. **Every product on the order** gets stars (each with its word); comments optional. The server also refuses a new order while one is unrated. | |

- [ ] Explain **why pay after acceptance**: if the seller rejects, no money
      is stuck with no refund route
- [ ] Explain **why UTR must be exactly 12 digits** and cannot be reused on
      another order
- [ ] Seller side afterwards: **Reviews** (the product is named, and each
      review has a **Report** link for an abusive one), **rating on home**,
      **My buyers**
- [ ] At the foot of the seller's order screen: **Report this buyer** (for a
      buyer who never took delivery or claimed a payment that never came).
      Anonymous to the buyer; nobody is blocked on one report.
- [ ] Customer: **My Orders** tabs: active / completed / cancelled

---

## 8. Orders 2–4: the other paths (20 min)

- [ ] **Order 2: Cash on delivery + outside area.** Use a Maharashtra
      pincode *not* in the seller's list. The seller sees **"outside your
      area"**; accepting means "yes, I can get there". Walk it quickly to
      delivered; no payment step.
- [ ] **Try a non-Maharashtra pincode** (e.g. Goa 403xxx or Delhi 110001):
      refused at checkout
- [ ] **Order 3: the buyer cancels** while it is still *Placed*: 3 steps
      (consequence → **reason from list** → final confirm). Show that after
      acceptance the buyer's cancel button is gone and says to call the seller.
- [ ] **Order 4: the seller cancels** after accepting (the button is at the
      bottom, not in the action bar): the same 3 steps, **then a fourth
      screen: the refund notice**. The app moves no money, so she must send
      it back. It closes only on "I understand".
- [ ] **Reject** an order at *Placed* from the seller side (reason required)
- [ ] Both sides show **who cancelled and why**, each in their own language
- [ ] **Updates list** on both sides: one row per order, labelled with its
      current state. The same events go to the other side's phone as a
      notification (APK only): a new order and a "buyer says paid" to the
      seller, each step and any cancel to the buyer, a cancel by the buyer
      to the seller, and every admin decision to the seller.

---

## 9. Admin console: the rest (20 min)

- [ ] **Sellers**: register list, subscription pill with date, filters
      (ending this week, expired, reported), **Sort by** (e.g. highest earned)
- [ ] **Seller detail**: profile, readiness, FSSAI number, **policies
      accepted** (and when), products, payments, reviews, reports about her
      shop (with **Close reports**)
  - [ ] **Record payment** (section 3), **Grant slots / Remove slots**
  - [ ] **Block** with a reason. Show on the customer side that her whole
        shop disappears. **Unblock** again.
  - [ ] **Close account on her request**: for a seller who cannot sign in
        (lost phone, OTP not arriving). Staff pick how the request came in,
        tick that they **rang the registered number back**, and type her
        last 4 digits. Same effect as her own button, including the 7 days
        and **Reopen account**. Explain it; do not press it.
- [ ] **Products**: tabs **To review / Published / Reported**. **Take down**
      a live one (it is deleted and the slot comes back). A reported listing
      stays live until someone decides: take it down, or **Close reports**.
- [ ] **Orders**: list, open one in the detail panel, who ended it and why
- [ ] **Reviews**: low-rating, hidden and **reported** filters, **Hide** with
      a reason. Show it vanish from the product page and the seller's
      average.
- [ ] **Complaints**: what sellers and buyers sent from **Raise a
      complaint**, with **Call**, **Open her account** and **Mark done**.
      Below it: **Reported buyers** (grouped by buyer, with **Block this
      number**), **Block a buyer by number**, and **Close a buyer's
      account** (for a buyer who cannot sign in; no undo). A blocked buyer
      cannot sign in or order, and closing her account does not lift it.
- [ ] **Impact**: programme numbers, **Copy for report**
- [ ] Admin language switch; sort choice remembered per list

---

## 10. Behind the scenes (optional, 5–10 min, for the technical part of the audience)

- [ ] One API (Cloud Run), two websites (Vercel), a Firestore database,
      Cloudinary photos, MSG91 SMS
- [ ] Every rule is checked **on the server**, not only on the screen (slot
      limits, order steps, who may edit what)
- [ ] Login security: tokens that can be revoked, 15-day idle logout (and a
      fresh login every 90 days regardless), OTP limits
- [ ] Privacy: the public sees only the seller's shop card. **Her phone
      number is on no public page**: a signed-in buyer gets it on her own
      order, or from the cart's "Ask about delivery". Reviews show the
      buyer's first name only.
- [ ] Consent is **recorded, not assumed**: the tick at registration, and a
      one-time "The market's rules" screen for everyone who signed up
      before the policies (or when they change), ending in "I agree, and I
      am 18 or older"
- [ ] **Deleting an account** works in the app and from the public
      **/delete-account** page. What is erased and what is kept (order
      records, reviews, the ₹50 ledger, without her number) is written in
      the privacy policy.
- [ ] **Phone notifications** come from the server to the Android app only.
      If she refused permission, a yellow bar says notifications are off,
      with **Open settings**.
- [ ] Scrolling memory: go deep into the catalogue, open a product, press
      Back, and you land where you were
- [ ] Offline screen when the connection drops

---

## 11. Close and Q&A (10 min)

- [ ] Recap the life cycle in one sentence: *join → pay ₹50 → add product →
      approved → order → accept → paid → deliver → rated*
- [ ] **What is not built yet** (say it before someone asks): chat,
      disputes, returns and refunds inside the app, seller replies to
      reviews, coupons, taking a photo directly with the camera, courses and
      certificates
- [ ] How the audience can help: registering sellers in their villages,
      taking good product photos, teaching the payment steps
- [ ] Contact: the college office, **9420488874** (the Help tab's Call and
      WhatsApp buttons). Formal grievances go to the grievance officer named
      on the **Grievances and Contact** policy page.

---

## 12. Cleanup straight after (this is the live site)

- [ ] Cancel any order still open
- [ ] Admin: **take down** the demo products (this deletes them), or
      **block** the demo seller
- [ ] **Hide** the demo reviews, **Close reports** on anything reported
      during the demo, and **Mark done** any demo complaint
- [ ] If the demo numbers were new and will not be used again, delete both
      accounts from their own profiles (**Delete my account**). The seller's
      details are erased after 7 days; the orders stay, without her number.
- [ ] Note the ₹50 and the ₹10–20 payments for the accounts
- [ ] Log out of all three apps on the laptop, and clear both browser
      profiles if the laptop is shared

---

### Time plan

| Section | Minutes |
|---|---|
| 0 Setup (before the audience arrives) | 30 |
| 1 Introduction | 10 |
| 2 Seller registration | 20 |
| 3 Home + subscription | 15 |
| 4 Products + moderation | 20 |
| 5 Seller tools | 15 |
| 6 Customer shopping | 20 |
| 7 Order 1 (UPI) | 25 |
| 8 Orders 2–4 | 20 |
| 9 Admin | 20 |
| 10 Behind the scenes | 5–10 |
| 11 Q&A | 10 |
| **Talking time** | **about 3 h** |

If time is short, cut section 10, do only one of orders 3 and 4, and in
section 9 describe the account-closing and buyer-blocking cards rather than
opening them.
