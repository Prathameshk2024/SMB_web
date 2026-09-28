# Manual test plan — शांताई महिला बाजार / Shantai Mahila Bazar

An end-to-end manual test suite covering the seller app, the customer app, the admin
console, and the API behind all three. Written to be run by one person on a laptop
with two browser profiles, in roughly this order — later suites depend on data created
by earlier ones.

Every row is a test. Tick the box when the "What must happen" column is true on screen.
When it is not, record it with the bug template in section 24.

---

## 0. Before you start

### 0.1 Environment

```bash
npm install
npm run dev:all          # API :4000, seller app :5173, admin console :5174
```

Watch the API boot banner. It prints which integrations are actually live
(`describeConfig()` in `backend/src/config.ts`). Read it before reporting an
integration as "broken" — with an empty `.env` you get the JSON-file database,
no Cloudinary, demo OTP and no push, and all four are the intended degraded modes.

A fresh clone starts with an **empty** database. The seed below needs
`SEED_DEMO_DATA=true` in `backend/.env` (development only — production refuses to
boot with it). Several rows need Cloudinary on (photos, payment screenshots); run
those with `CLOUDINARY_URL` set and the rest either way.

| Surface | URL |
|---|---|
| API health | http://192.168.31.110:4000/api/health |
| Seller + customer app | http://192.168.31.110:5173 |
| Admin console | http://192.168.31.110:5174 |

### 0.2 Two browser profiles are mandatory

The seller app and the customer app are the same origin (`:5173`) and share **one**
localStorage session key, `wb.session`. You cannot be signed in as a seller and as a
customer in the same browser at the same time. Use:

- **Profile A** — the seller (Chrome, normal window)
- **Profile B** — the customer (Chrome incognito, a second profile, or Firefox)
- **Profile C** — the admin console at `:5174` (separate origin, separate storage)

Several order-lifecycle tests need A and B open side by side.

### 0.3 Resetting the data

```bash
# Either delete the file and restart the API
rm backend/data/db.json

# Or, while it is running with ALLOW_DEV_RESET=true in backend/.env
curl -X POST http://192.168.31.110:4000/api/dev/reset
```

`/api/dev/reset` 404s unless `ALLOW_DEV_RESET=true` is set, and always when
`NODE_ENV=production`. It resets the database only — not the in-memory rate limiters
(restart the API for those) and not the seed sellers' subscription terms, which are
stamped at boot. Re-seed before Suites C, F and K — they consume slots and change
seller status.

### 0.4 Automated gates — run these first

A manual pass over a build that already fails `npm test` wastes a day.

- [ ] `npm run typecheck` — all three workspaces clean
- [ ] `npm test` — backend + frontend + admin all green
- [ ] `npm run build` — backend tsc and both Vite builds succeed

### 0.5 Admin account

There is no default admin password.

```bash
npm run admin:users -- create you@example.com "Your Name"
```

Note the email and password; Suite L needs them.

### 0.6 Seed accounts and their shape

Everything in Suites G–I depends on these numbers, from `backend/src/db/seed.ts`.

| Seller | Shop (what buyers see) | Phone | ID | Village | Packs (slots) | Delivery | Free above | Min order | Pincodes |
|---|---|---|---|---|---|---|---|---|---|
| सुनीता पाटील | सुनीता गृहउद्योग | 9822011223 | SMB-ANADUR-01 | आणदुर | 1 (5) | ₹20 | ₹500 | ₹100 | 413601, 413602, 413604 |
| मंगल जाधव | मंगल हातमाग | 9764455661 | SMB-JEVALI-01 | जेवळी | 2 (10) | ₹40 | ₹1500 | ₹0 | 413603, 413601 |
| कविता शिंदे | कविता गृहउद्योग | 9890033441 | SMB-BHOSGA-01 | भोसगा | 1 (5) | ₹0 — reads "विक्रेतीला विचारा", never "free" | — | ₹150 | 413604, 413601 |

Products of note: `p1` ₹220 (stock 12) and `p2` ₹180 (stock 8) are Sunita's two
buyable items; `p3` (papad, ₹90) has **stock 0**; `p4` (ghee, Sunita) is **PENDING**
so it must never appear in the public catalogue; `p9` (पुरणपोळी, Kavita) is **made to
order**; `p11` (incense, Kavita) is ₹60. No seed product has a pack size, so each
reads as a listing from before that question existed.

The seed orders belong to customer ids `c1`–`c4`, while a login creates `c-<phone>`,
so they never appear under a buyer's own "My orders" — create fresh orders for Suite I.
Logging in as `9011223344` still gives a registered buyer (Priya) with saved addresses
at 413601 and 413603. `SMB1043` is seeded PLACED with `UPI_SUBMITTED`, a state the
current flow can no longer produce (UPI is paid after acceptance).

The payments queue seeds with three PENDING rows — one flagged `duplicateUtr`, one that
has been waiting ~50 hours — plus one already APPROVED. None carries a screenshot, a
payment time or a kind, and the three pending ones belong to seller ids (`s4`–`s6`)
that are not in the seed — approving one changes no seller. Test approval end to end
with a payment you submit yourself in Suite D.

The Play reviewers' demo number is `9999999999` (`DEMO_PHONE` in `backend/src/demo.ts`);
it is both a seller and a buyer, and Suite V checks that it is kept apart.

Slot use at seed: Sunita 4/5 (`p4` PENDING counts), Mangal 4/10, Kavita 3/5 — so no
seeded seller may buy a pack yet. Seed sellers have no `subscriptionEndsAt` until the
API **boots** (`backfillSubscriptionTerms`), so after `/api/dev/reset` restart the API
too. They also have no `acceptedPolicies`, so each meets the full-screen PolicyGate
(Suite U) on first sign-in — agree and carry on.

Any 10-digit number starting 6–9 is a valid login, but each number gets only **three
codes in 24 hours** (Suite B). The OTP screen **shows** the 6-digit code in demo mode,
and that code is really checked — anything else is refused.

---

## 1. Suite A — Landing page and public surface

Profile B, signed out. Start at http://192.168.31.110:5173.

| ID | What to do | What must happen |
|---|---|---|
| ☐ A1 | Load `/` | Renders in **Marathi** by default. The brand portrait shows with its own gold ring and **no** extra border or background box |
| ☐ A2 | Watch the photo strips for ~10s | Both strips cross-fade every 2 seconds |
| ☐ A3 | Enable OS "reduce motion", reload | Strips hold on the first frame, no fading |
| ☐ A4 | Inspect the category tiles, then tap one | Photographs, not emoji. Signed out, a tile goes through the buyer's door to `/login/customer` |
| ☐ A5 | Switch language to English | Every visible string changes, **including input placeholders**. The only Devanagari left is deliberate: the brand name "शांताई महिला बाजार" in header and footer, the "मराठी" language button, and the college card's Marathi line. (Server error bodies on the phone and OTP screens are still shown in Marathi — `messageMr` — even in English) |
| ☐ A6 | Reload after switching | The language choice survives the reload (`wb.lang`) |
| ☐ A7 | Tap the customer door | Lands on `/login/customer` |
| ☐ A8 | Tap the seller door ("मला विकायचं आहे") | Lands on `/login/seller`. There is no separate "I am new" door: a **new** number, after the correct OTP, is shown "आधी नोंदणी करावी लागेल" with a "नोंदणी करा" button into the wizard. (`/join/seller` still works if typed) |
| ☐ A8a | Signed in as a customer, tap the seller door | A sheet asks her to log out and sign in again, with "लॉग आउट करा". (Known bug, 2026-09-28: the sheet is titled "विक्री विभाग" even when switching towards buying) |
| ☐ A8b | The landing footer | Links to "धोरणे आणि अटी" (`/legal`), "गोपनीयता धोरण" (`/legal/privacy`) and "खाते बंद करा" (`/delete-account`) — all open signed out |
| ☐ A9 | Visit `/seller` while signed out | Redirected to `/` — no seller screen flashes first |
| ☐ A10 | Visit `/shop/cart` (or `/shop/seller/s1`) while signed out | Redirected to `/` — the shop pages need a customer session |
| ☐ A11 | Visit `/nonsense-route` | Redirected to `/` |
| ☐ A12 | Visit `/register/seller` with no ticket | Redirected to `/login/seller`, not a dead form |
| ☐ A13 | Measure text and buttons in devtools | Body text ≥16px, primary buttons at the `--btn-h` token (54px in `theme.css` today, although CLAUDE.md says 56 — record which is intended), tap targets ≥44px. (Known gap, 2026-09-28: the landing header's language buttons are 34px tall with ~13px text — log it) |
| ☐ A14 | Look at any price | Latin digits (`₹500`), never `५००` |
| ☐ A15 | Devtools → Network, filter Font | **No web font requests.** Marathi renders from the system font |
| ☐ A16 | Look for a hamburger menu anywhere | There is none |

---

## 2. Suite B — Authentication, OTP and sessions

Profile B unless stated. The per-number send limit is **three codes in 24 hours**, and
the limiters live in the API's memory — restart the API (not `/api/dev/reset`) to clear
them between runs, or use a fresh number for each row that sends.

### 2.1 Phone entry

| ID | What to do | What must happen |
|---|---|---|
| ☐ B1 | `/login/customer`, enter `123` | Refused on the phone with "10 अंकी मोबाईल नंबर टाका"; no request is sent |
| ☐ B2 | Enter `1234567890` (starts with 1) | Refused the same way — Indian mobiles start 6–9 |
| ☐ B3 | Type `+91 98220 11223` into the box | The box keeps digits only, has a fixed "+91" label and stops at 10 digits. (Known bug, 2026-09-28: it keeps `9198220112`, which is valid, so a code goes to the **wrong** number — log it.) Via curl, `POST /api/auth/otp/send {"phone":"+91 98220 11223"}` is accepted and normalised to the ten digits |
| ☐ B4 | Type `09822011223` | The box stops at `0982201122` and refuses it. Via curl the server strips the leading `0` and accepts it |
| ☐ B5 | Enter a valid new number | Toast "OTP पाठवला"; the OTP screen appears and, in demo mode, **shows the 6-digit code** ("चाचणी: खाली दिसणारा 6 अंकी कोड टाका · …"). With the MSG91 widget configured, no code is shown |
| ☐ B5a | Look under "Send OTP" on the phone screen | "पुढे जाऊन तुम्ही हे मान्य करता:" with links to the Terms of Use and the Privacy Policy |

### 2.2 OTP verification

| ID | What to do | What must happen |
|---|---|---|
| ☐ B6 | Type a wrong 6-digit code | Refused with "OTP चुकीचा किंवा कालबाह्य आहे. पुन्हा पाठवा." — the same words for wrong, expired or used up; it never says *which* |
| ☐ B7 | Type the shown code | "लॉगिन झाले"; a seller goes to `/seller`, a registered customer to `/shop` |
| ☐ B8 | On a new number, type 5 wrong codes in a row | The code is destroyed after the 5th. The correct code no longer works — you must resend |
| ☐ B9 | Tap "पुन्हा OTP पाठवा" within 30 seconds of the last send | Refused by the cooldown: "OTP आत्ताच पाठवला आहे. {n} सेकंदांनी पुन्हा प्रयत्न करा." Even a refused tap counts towards the day's three |
| ☐ B10 | Wait 5 minutes, then use the code | Expired, refused with the same message as B6 |
| ☐ B11 | Send a 4th code to one number within 24 hours | **429** with `Retry-After` and "खूप वेळा प्रयत्न झाले. 1 दिवसाने पुन्हा प्रयत्न करा." — in days or hours, never "1440 मिनिटांनी", and "1 दिवसाने" in the singular |
| ☐ B11a | Send four codes to the demo number `9999999999` | No 429 — it is the one number exempt from the send limit |
| ☐ B12 | 11 verify attempts in 15 minutes on one number | The 11th returns 429 |
| ☐ B13 | After B12, verify correctly on a fresh number | Still works — the limiter is per-subject, not global |
| ☐ B13a | Block a buyer's number in the console (S12), then sign in with it and the correct code | 403, and under the code boxes: "हा नंबर बाजारात बंद केला आहे. मदतीसाठी बाजाराच्या कार्यालयाशी संपर्क करा." — **not** "wrong code", and no session is issued |

### 2.3 Registered vs. authenticated customer

| ID | What to do | What must happen |
|---|---|---|
| ☐ B14 | Log in with a **brand-new** customer number | Sent to `/register/customer` — authenticated but not registered |
| ☐ B14a | Look at the name screen | "मान्य करण्याआधी वाचा:" with links to the terms, privacy policy and refunds policy, then one tick: "मी वरील अटी आणि धोरणे वाचली आहेत, मला ती मान्य आहेत, आणि माझे वय 18 किंवा त्याहून जास्त आहे" |
| ☐ B15 | Leave the tick off | "नोंदणी पूर्ण करा" stays disabled. Tick it and submit an empty or spaces-only name: "नाव टाका" under the field |
| ☐ B15a | Via curl, the first `PATCH /api/customers/me` with a name but no `acceptPolicies: true` | 400 "पुढे जाण्यासाठी अटी आणि गोपनीयता धोरण मान्य करा." — a missing field is an old app that never drew the box |
| ☐ B16 | Give a name, tick, submit | Toast "नोंदणी पूर्ण झाली"; lands on `/shop`. `acceptedPolicies` on her record carries the current `POLICY_VERSION` and a time |
| ☐ B17 | Log out, log in with the same number | Goes **straight to `/shop`**, no name screen and no second consent |

### 2.4 Session persistence — only logout and a 401 may end a session

| ID | What to do | What must happen |
|---|---|---|
| ☐ B18 | Signed in as a customer, press Back repeatedly to `/` | Still signed in. The landing page renders and does not bounce you |
| ☐ B19 | From `/`, open `/login/customer` while signed in as a customer | Redirected straight to `/shop` — never asked for another OTP |
| ☐ B20 | Signed in as a seller, open `/login/seller` | Redirected straight to `/seller` |
| ☐ B21 | Signed in as a **seller**, open `/shop` | Redirected to `/seller` (own home), **not** to `/` |
| ☐ B22 | Signed in as a **customer**, open `/seller` | Redirected to `/shop` |
| ☐ B23 | Hard-refresh (Ctrl+Shift+R) on any signed-in screen | Still signed in |
| ☐ B24 | Close the tab, reopen the URL | Still signed in |
| ☐ B25 | Log out explicitly | A confirmation first, then "बाहेर पडलात" and back at `/`. `wb.session` and `wb.token` are both gone from localStorage |
| ☐ B26 | After logout, press Back into `/seller`; then replay the old token with curl | Redirected to `/`, and the curl call is **401** — the token is dead server-side, not merely cleared locally |
| ☐ B26a | Block `localStorage` for the site (devtools → Application, or a strict private window) and sign in | The app still works for the whole visit — the token is held in memory; storage only carries it across a reload |

### 2.5 Token rotation (the one that breaks silently)

The server re-stamps a token only once it is **past half its idle window** — 7.5 days
for a seller or buyer, 4 hours for an admin — so a fresh session never shows it. Test
on the admin console after 4+ hours of use, or age the session row's timestamps in
`db.json` and restart.

| ID | What to do | What must happen |
|---|---|---|
| ☐ B27 | Devtools → Network. Trigger any API call on a session past half its window and inspect the response headers | The response carries `X-Session-Token`, and it is **readable** by JS — i.e. it survives the CORS `exposedHeaders` list |
| ☐ B28 | After such a response, read `localStorage.wb.session` | The token **inside `wb.session`** has been replaced, not only an in-memory copy |
| ☐ B29 | Reload after B28 | Still signed in with the **new** token, not the original |

### 2.6 Admin login (Profile C, `:5174`)

| ID | What to do | What must happen |
|---|---|---|
| ☐ B30 | Sign in with the account from §0.5 | The console home renders |
| ☐ B31 | Sign in with an unknown email | Refused with "Email or password is wrong" — identical to a wrong password, no account enumeration |
| ☐ B32 | 6 sign-in attempts on one email in 15 minutes, none successful | Attempts 1–5 are 401; the **6th** is 429 |
| ☐ B33 | Signed out, open `/payments` directly | The sign-in screen only. No shell, no navigation, no half-rendered queue behind it |

---

## 3. Suite C — Seller registration (6-step wizard)

Profile A. **Reseed first** if you have already registered on this number.
Use a fresh 10-digit number per run.

| ID | What to do | What must happen |
|---|---|---|
| ☐ C1 | `/login/seller` → new number → OTP → "नोंदणी करा" | Lands on "पायरी 1 पैकी 6" with progress dots. The six steps: about you → village and address → your business → digital use → where your money arrives → check. There is no dispatch-time question, and no delivery fee or minimum order |
| ☐ C2 | Count the questions per screen | One question (or one tight group) per screen — this is a wizard by design |
| ☐ C3 | Press Back on step 1 | Returns to `/`; it does not trap you |
| ☐ C4 | Leave the required name blank, press Next | Blocked with "आवश्यक" under the field |
| ☐ C5 | Enter age `12` | Refused — the field shows `18 - 90` (the server's message is "वय 18 ते 90 दरम्यान असावे") |
| ☐ C6 | Enter age `95` | Refused |
| ☐ C7 | Enter pincode `012345` | Refused — 6 digits, not starting with 0 |
| ☐ C7a | Pick जेवळी, then येळी | Taluka and district fill themselves per village (जेवळी → लोहारा, येळी → उमरगा), and a live ID preview updates |
| ☐ C7b | On "your business", answer "होय" to "तुम्ही खाद्यपदार्थ विकता का?" | An optional "FSSAI क्रमांक" field appears. Blank is fine; `123` is refused with "FSSAI क्रमांक 14 अंकांचा असतो" |
| ☐ C8 | Enter UPI `notaupi` | Refused: "UPI आयडीमध्ये एकच @ असतो. उदा. sunita@ybl" |
| ☐ C8a | Enter UPI `sunita@ybll` | Refused **and named**: "\"@ybll\" तपासा. तुम्हाला \"@ybl\" म्हणायचे आहे का?" |
| ☐ C8b | Enter UPI `sunita@somenewbank` | **Accepted** — an unknown handle that is not a near miss is allowed, because new banks appear |
| ☐ C9 | Enter UPI `someone@ybl` | Accepted; a green notice echoes the ID back |
| ☐ C10 | Pick a **survey village** (आणदुर / जेवळी / भोसगा / चिवरी / रुद्रवाडी / येळी) | The final ID uses the fixed Latin code, e.g. `SMB-JEVALI-02`. (After a reseed the first new आणदुर seller is `SMB-ANADUR-02`, the same id the seeded payment `sp3` carries — do not be confused by it) |
| ☐ C11 | Register a second seller in the **same** village | The serial increments **per village**, not globally |
| ☐ C12 | Register in a village **not** on the survey list, typed in Devanagari | The ID carries a readable transliterated Latin code |
| ☐ C12a | On the check step, tap "बदला" beside any line | Jumps to that step with every answer kept |
| ☐ C12b | On the check step, look at the consent | "मान्य करण्याआधी वाचा:" with four links (seller agreement, terms, privacy, refunds), then one tick: "मी वरील करार, अटी आणि धोरणे वाचली आहेत, मला ती मान्य आहेत, आणि माझे वय 18 किंवा त्याहून जास्त आहे". "नोंदणी पूर्ण करा" is disabled until it is ticked |
| ☐ C13 | Tick and finish the wizard | "नोंदणी झाली!", her `SMB-…` ID card and readiness score, "आता 50 रुपये भरा आणि 5 उत्पादने टाका." and she is signed in as a seller. Her record carries `acceptedPolicies` with the current version |
| ☐ C14 | Open her home screen, and her row in the admin console | Home shows "प्रशासकाच्या मंजुरीची वाट पहा"; the console pill reads "Registered" — not ACTIVE. She cannot submit a listing until the ₹50 is approved |
| ☐ C15 | Leave "about" blank, then look at her shop card | A default Marathi description was composed from shop name + village (+ SHG, + years). The shop is never blank |
| ☐ C16 | Choose "बचत गट सदस्य" and give an SHG name | The SHG appears in the generated description |
| ☐ C17 | Sign in on the seller door with an already-registered number | Straight to `/seller` — no ticket, no wizard. Via curl, registering that number again is **409** "हा नंबर आधीच नोंदणीकृत आहे. लॉगिन करा." |
| ☐ C18 | On the check step, open a policy link, switch the language on that page, press Back | Every answer and the step are restored (`sessionStorage`, keyed by phone). The consent tick is **not** — she ticks it again. (The wizard itself has no language control) |
| ☐ C18a | Leave the wizard, then open `/login/seller` again | "तुमचा नंबर आधीच तपासला आहे" with "नोंदणी पुढे सुरू ठेवा" — no second OTP, answers intact |
| ☐ C19 | Upload the payment QR photo on step 5 ("तुमचा पेमेंट QR (ऐच्छिक)") | The upload succeeds **even though no seller record exists yet** — the registration ticket authorises it |
| ☐ C20 | Wait 15+ minutes mid-wizard, then submit | The ticket has expired: a red notice "आधी मोबाईल नंबर तपासा. पुन्हा OTP मागवा." on the check step. A reload goes to `/login/seller`; after a new OTP the answers come back |

### 3.1 The registration gate (API level, curl)

| ID | What to do | What must happen |
|---|---|---|
| ☐ C21 | `POST /api/sellers/register` with a full valid body, `acceptPolicies: true` and **no** `ticket` | **401**. No seller created, no session issued |
| ☐ C21a | A valid ticket, but `acceptPolicies` absent (or the string `"true"`) | **400** "पुढे जाण्यासाठी अटी आणि गोपनीयता धोरण मान्य करा." — and the ticket is **not** spent: the same ticket then succeeds with `acceptPolicies: true` |
| ☐ C22 | The same, with a `ticket` already used once | 401 — tickets are single-use |
| ☐ C23 | A valid ticket but a **different** phone in the body | The seller is created against the **ticket's** phone. The body's phone is ignored entirely |
| ☐ C24 | 11 registration attempts from one IP in an hour | 429 |

---

## 4. Suite D — Subscription, slots and payment approval

Profile A as a newly registered (REGISTERED) seller, Profile C as admin, in a
**browser** (inside the APK the pay screen does not exist — see P10–P13). Cloudinary
must be on for the screenshot rows.

| ID | What to do | What must happen |
|---|---|---|
| ☐ D1 | The new seller opens "new product" | The wizard does not open: "प्रशासकाच्या मंजुरीची वाट पहा" and a button to the registration fee. Via curl, `POST /api/products` is **403** with the same words |
| ☐ D2 | Via curl, the same seller posts `asDraft: true` | 201, DRAFT. A draft consumes no slot |
| ☐ D3 | Open the subscription screen | ₹50 = 5 slots, "दुकान सुरू ठेवण्यासाठी दर 6 महिन्यांनी ₹50 भरून नूतनीकरण करावे लागते.", the QR, the numbered steps, the payee name exactly as printed on the poster, and the UPI ID with a copy icon. No payment gateway and **no "Pay" button and no "Save QR" button** |
| ☐ D3a | Read the steps | Screenshot the QR (power + volume-down), open PhonePe or Google Pay, scan, tap the gallery icon and pick the screenshot, check name and amount, pay; screenshot the success screen; come back for the 12-digit UTR |
| ☐ D3b | Copy the UPI ID, switch to another app, come back | "पैसे भरून झाले का? खाली 12 अंकी UTR नंबर टाका." and the UTR box is scrolled into view and focused — once per copy |
| ☐ D4 | Type a UTR of `12345` | "माहिती पाठवा" stays **disabled**. Via curl: 400 "UTR 12 अंकी असतो, तुम्ही 5 अंक टाकले. UPI ॲपमध्ये तो पुन्हा पहा". Spaces and hyphens are stripped; letters are refused |
| ☐ D4a | A valid UTR but no screenshot | Still disabled, with "माहिती पाठवण्याआधी पेमेंटचा स्क्रीनशॉट जोडा." Via curl without one: 400; with a pasted image URL: 400 "स्क्रीनशॉट पुन्हा जोडा" |
| ☐ D4b | Set "पैसे कधी भरले?" to tomorrow, then to 8 days ago | "ही वेळ अजून यायची आहे. …" and "ही तारीख 7 दिवसांपेक्षा जुनी आहे. …"; the button stays disabled |
| ☐ D5 | Submit a 12-digit UTR, the screenshot and the time | "पेमेंटची माहिती पाठवली", and the waiting screen: "तुमच्या भरण्याची माहिती पाठवली आहे". Reopening `/seller/subscription` returns her to the waiting screen |
| ☐ D6 | Submit a **second** payment via curl while the first is pending | **409** "तुमचा भरणा आधीच तपासणीसाठी पाठवला आहे." — one pending payment at a time. The admin queue must not grow a duplicate ₹50 row |
| ☐ D7 | Admin console → Payments | Her row is there with the screenshot, the stated time, the kind ("New pack") and a "Waiting 0m" pill that grows through hours to days |
| ☐ D8 | Admin ticks the three checks and approves | Her status flips to **ACTIVE**, `packsApproved` +1, her term ends six calendar months from today (IST), and she is notified: "तुमचा ₹50 चा भरणा मंजूर झाला — 5 जागा मिळाल्या" |
| ☐ D9 | Back in Profile A, the waiting screen | Notices the approval without a manual reload — it polls every 10 seconds while visible: "अभिनंदन! तुमची नोंदणी मंजूर झाली" |
| ☐ D10 | She sends in 5 products | All 5 land **PENDING** ("तपासणी सुरू"), not live — and the slot meter reads 5/5 at once, because a pending listing holds its slot. Each goes live only when an admin publishes it (L11) |
| ☐ D11 | Try to send in a 6th | "New product" is disabled, and `/seller/upload` shows "सर्व 5 जागा भरल्या आहेत" instead of the wizard. Confirm the **server** refuses it too: `POST /api/products` via curl is **402** "सर्व जागा भरल्या आहेत. आणखी 5 जागांसाठी 50 रुपये भरा." |
| ☐ D12 | With 5/5 used, submit a payment | Allowed (kind: pack) |
| ☐ D13 | With slots still free (say 3/5 used), open the subscription screen | No form: "आत्ता पैसे भरण्याची गरज नाही". Via curl: **409** "तुमच्याकडे अजून 2 जागा शिल्लक आहेत. आत्ता पैसे भरण्याची गरज नाही." |
| ☐ D14 | Try to free a slot yourself from a LIVE product | Impossible — see F13a. The slot frees only when an admin rejects or takes a listing down (L13); the meter then drops to 4/5 at once |
| ☐ D15 | While full, save a draft via curl (`asDraft: true`) | 201 — drafts never consume a slot. (The app's wizard is closed while full, so this is API only) |
| ☐ D16 | Pause a live product | It **still** consumes its slot (PAUSED is slot-consuming) |
| ☐ D17 | Admin rejects a payment with a reason | Her status becomes **PAYMENT_REJECTED** (unless she is BLOCKED or has another approved payment); she is notified, and her waiting screen shows "पेमेंट मंजूर झाले नाही", the reason and "पुन्हा माहिती पाठवा" |
| ☐ D18 | Admin rejects a *duplicate* payment for a seller who has another approved one | She stays ACTIVE — clearing a duplicate must not revoke an account another payment paid for |
| ☐ D19 | Admin approves the same payment twice | The second is **409 "यावर आधीच निर्णय झाला आहे"** — no double pack |
| ☐ D20 | Admin grants 1 pack to a REGISTERED seller | She becomes ACTIVE with 5 slots and a six-month term, and is notified in **slots**, not packs: "तुम्हाला 5 नवीन जागा मिळाल्या आहेत" |
| ☐ D21 | Admin revokes more packs than she has spare | **409** with the numbers spelled out. Nothing is silently un-published |
| ☐ D22 | Admin revokes her **last** pack while nothing is published | She drops to REGISTERED, not ACTIVE-with-zero-slots |
| ☐ D23 | Submit a UTR already used by a **different** seller | The row carries a red "Same UTR again" pill in the admin queue |

### 4.1 The six-month term, expiry and renewal

Set her `subscriptionEndsAt` in `db.json` and restart the API to reach each state. The
server's clock decides, never the phone's.

| ID | What to do | What must happen |
|---|---|---|
| ☐ D24 | An ACTIVE seller more than 7 days from her end date | A quiet line "वर्गणी {date} पर्यंत सुरू आहे" on the slot card. A renewal is not yet payable: via curl, 409 "वर्गणी संपण्याच्या 7 दिवस आधीपासून नूतनीकरण करता येते." |
| ☐ D25 | Set the end date 3 days ahead | Home and My Products show "3 दिवसांत तुमची वर्गणी संपेल" with "₹50 भरून नूतनीकरण करा"; at 1 day, "1 दिवसात तुमची वर्गणी संपेल". Her updates list carries the same reminder. The console pill turns amber ("Ends in 3 days · …") and she counts under "Subscriptions ending this week" |
| ☐ D26 | Renew now and have the admin approve it | The end date moves six months from the **current end**, not from today — no paid day is lost. She is told "नूतनीकरण मंजूर झाले!" with the new date |
| ☐ D27 | Set the end date to yesterday | "तुमची वर्गणी संपली आहे — दुकान बंद आहे". Her shop and products leave the catalogue, `GET /api/sellers/<id>` is 404, and `POST /orders` for her is refused. **Nothing is rewritten**: her products stay LIVE in `db.json` (her list shows "वर्गणीमुळे थांबवले"), `isOpen` is untouched, no slot is released |
| ☐ D28 | While expired, try to send in a listing, and to buy a pack | The wizard shows "आत्ता नवीन उत्पादन पाठवता येणार नाही" (API: 403); only a renewal is payable (a pack is 409 "आधी वर्गणीचे नूतनीकरण करा. …") |
| ☐ D29 | While expired, advance or cancel an order already in progress | Still allowed — orders in flight carry on |
| ☐ D30 | Renew while expired and have it approved | The shop reopens **exactly as before** — same slots, same products, same open switch — and the term runs six months from the approval |

---

## 5. Suite E — The upload wizard and its draft

Profile A as an ACTIVE seller with free slots.
Seven steps: photo → name → food yes/no → details (category, then ingredients and
veg/non-veg, or material) → price (price, MRP, unit, pack size, pieces per set) →
stock → preview. **Nothing goes live until an admin publishes it** — a submitted
listing lands on `PENDING` (`initialListingStatus()` in `shared/src/seller.ts`).

| ID | What to do | What must happen |
|---|---|---|
| ☐ E1 | Open "new product" | "पायरी 1 पैकी 7" / "Step 1 of 7" with progress dots, one question per screen |
| ☐ E2 | Press Back on step 1 | Returns to `/seller` |
| ☐ E3 | Try to advance past the photo step with no photo, Cloudinary configured | Blocked with "आवश्यक" / "Required" — a photo is required (client-side; the server accepts a listing with no image) |
| ☐ E4 | The same with Cloudinary **not** configured (empty `.env`): pick a photo | The upload fails with `photo.disabled` "फोटो अपलोड सध्या बंद आहे. फोटोशिवाय पुढे जा." and the step **can then be passed** — it is never a wall she cannot get past. (Before any pick, Next is still blocked: the picker only learns Cloudinary is off from the failed signature request) |
| ☐ E5 | Look for a camera button or an emoji fallback grid | Neither exists. One "गॅलरीतून निवडा" / "Choose from gallery" button, one photo |
| ☐ E6 | After picking a photo, look at "choose from gallery" | Disabled — it does not silently replace the photo |
| ☐ E7 | Tap the ✕ on the thumbnail, then pick **the same file again** | It is accepted. (The input resets its own `value`; without that, no `change` event fires) |
| ☐ E7a | Pick a photo larger than 5MB | Refused before any upload: "हा फोटो {size}MB आहे. 5MB पेक्षा लहान फोटो निवडा." A non-image file: "हा फोटो नाही. JPG किंवा PNG फाइल निवडा." |
| ☐ E7b | Pick a 4MB photo and watch the upload in devtools → Network | The bytes sent to Cloudinary are a JPEG of at most 1200px on the long edge, around 350KB. A transparent PNG arrives with a **white** background, not black |
| ☐ E8 | On the name step, leave the name blank | Blocked |
| ☐ E9 | Mark it food; on the details step leave ingredients blank | Blocked with "आवश्यक" / "Required" under the field (the server's own "यात काय आहे ते सांगा" is only seen via curl) |
| ☐ E10 | Mark it food, skip veg/non-veg | Blocked |
| ☐ E11 | Mark it **not** food, leave material blank | Blocked. The category is required on the same step |
| ☐ E11a | Look at the category list for a food product and for a non-food one | "इतर" / "Other" is in **both** lists, last. Changing the food answer clears the chosen category |
| ☐ E12 | Set price `0` | Blocked |
| ☐ E12a | On the price step, leave the pack size empty | Blocked. The field is "एका नगात किती?" / "How much is one?", with the chosen unit printed beside it |
| ☐ E12b | Choose unit "सेट" / "set" | A second field appears, "एका सेटमध्ये किती नग?" / "How many in one set?", and it is required. The preview prints the size as "1 सेट (6 नग)" |
| ☐ E13 | Tick "made to order" | Stock is sent as 0 and the stock field is disabled |
| ☐ E14 | On the preview step, tap any summarised chip ("… · बदला") | Jumps back to that exact step |
| ☐ E15 | Read the preview, then press the button | The button reads "तपासणीसाठी पाठवा" / "Send for checking", with "प्रशासक तपासून मंजूर केल्यावर तुमचे उत्पादन ग्राहकांना दिसेल." above it. The toast is "उत्पादन तपासणीसाठी पाठवले"; the listing is on her list with the "तपासणी सुरू" / "Being checked" pill and **takes a slot now**. (Known bug, 2026-09-28: the preview still shows a green "लगेच प्रकाशित होईल" notice, which contradicts the note — log it if it is still there) |
| ☐ E16 | Check the customer app | The product is **not** in the catalogue until an admin approves it (L10–L11) |
| ☐ E16a | Press "नंतर पूर्ण करते" / "Finish later" on the preview | Saved as a DRAFT ("मसुदा जतन झाला"), pill "अपूर्ण" / "Draft", no slot used |
| ☐ E16b | Try to submit a food listing via curl with `"fssai": "123"` | 400 with `fields.fssai` "FSSAI क्रमांक 14 अंकांचा असतो". There is no FSSAI field on the wizard or the edit page — it arrives only through the API — and a valid 14-digit number shows on the customer's product page as "FSSAI क्रमांक: …" |
| ☐ E16c | Submit via curl with an `imageUrl` that is not in this Cloudinary account's `product/` folder | 400, `fields.imageUrl` "फोटो पुन्हा जोडा" — a pasted URL cannot stand in for an upload |
| ☐ E16d | Submit via curl with `categoryId: "pickles"` | 400 "प्रकार निवडा" — only a known category id is accepted |

### 5.1 The draft (the shared-phone bug)

| ID | What to do | What must happen |
|---|---|---|
| ☐ E17 | Open the wizard and leave immediately without typing | `localStorage` has **no** `wb.draft.product.*` key — walking in and out leaves no trace |
| ☐ E18 | Fill steps 1–3, leave to change the language, come back | The work is still there |
| ☐ E19 | Inspect the storage key | It is `wb.draft.product.<sellerId>`, and the seller id is **also inside the payload** |
| ☐ E20 | Half-fill a draft as seller A, log out, log in as seller B on the same browser, open the wizard | Seller B sees a **blank** wizard. Not a stranger's photo on step 1 |
| ☐ E21 | Hand-create a legacy `wb.draft.product` key (no seller id), then open the wizard | The old key is deleted on sight and ignored |
| ☐ E22 | Complete and send in a draft, or press "Finish later" | The draft key is cleared |

---

## 6. Suite F — Editing, pausing and removing a product

Profile A. **Editing is not a wizard** — everything is on one page. A live
listing may have what it **is** changed twice (`MAX_EDITS`); price and stock are
always free.

| ID | What to do | What must happen |
|---|---|---|
| ☐ F1 | Open a live product → Edit | **One page**, every field visible. No steps, no dots. A notice reads "या उत्पादनात आणखी 2 वेळा बदल करता येईल." followed by "किंमत आणि साठा मात्र कधीही बदलता येतो." |
| ☐ F2 | Change only the price and save | Saved ("उत्पादन अपडेट झाले"), the product **stays LIVE**, and the edits-left count does **not** move |
| ☐ F2a | Open, change nothing, save | Costs no edit — values are compared, not keys |
| ☐ F3 | Tap ✕ on the photo, choose a new one, save | Saved, still LIVE, and **one edit is spent** — the photo is a counted field |
| ☐ F4 | Change name and category in one save | Saved, still LIVE. One save is one edit, however many counted fields change. The notice now says 1 left, in amber, and warns "हा तुमचा शेवटचा बदल आहे. …" as soon as a counted field is touched |
| ☐ F4a | Spend the second edit, reopen the page | Red notice "या उत्पादनाची माहिती आता बदलता येणार नाही." Photo, name, category, ingredients, material, MRP, unit, pack size and pieces per set are disabled; **price and stock still edit** |
| ☐ F4b | After F4a, change the veg/non-veg or made-to-order choice and save | Refused with **409** "या उत्पादनात 2 वेळा बदल करून झाले आहेत. किंमत आणि साठा मात्र कधीही बदलता येतो." (Known gap, 2026-09-28: those two choices are not disabled on screen although both are counted fields — log it if still so) |
| ☐ F4c | Edit a DRAFT or a PENDING listing several times | No limit and no notice — editing is limited on LIVE and PAUSED only |
| ☐ F5 | Look for a food ↔ handmade switch | There is none, and `isFood` is not accepted by `PATCH` — it picks the category set and which half of the fields apply |
| ☐ F6 | Save with an empty name | Refused on screen with "आवश्यक" / "Required" |
| ☐ F7 | Pause a live product with the pause icon on its row | Pill "थांबवले" / "Paused". It disappears from the customer catalogue. Pausing costs no edit |
| ☐ F8 | Un-pause it | Back to LIVE and visible again. A PENDING listing has no pause button |
| ☐ F9 | Open a DRAFT from the products list, press "तपासणीसाठी पाठवा" | Goes to **PENDING**, not LIVE — and only if she is ACTIVE (403 otherwise), her term has not ended (403) and she has a free slot |
| ☐ F10 | Send in a draft missing required fields | 400 "माहिती तपासा" with `fields`, the same checks as a new listing. Drafts are not a way around validation |
| ☐ F11 | Send in a draft when slots are full | **402**. "Save as draft" is not a way around the slot gate |
| ☐ F12 | On a **DRAFT**, tap "काढून टाका" / "Remove" | The sheet states the consequence: "हे अपूर्ण उत्पादन अजून पाठवलेले नाही, त्यामुळे त्याला जागा लागत नाही. काढले तर भरलेली माहिती परत मिळणार नाही." |
| ☐ F13 | Confirm | Toast "अपूर्ण उत्पादन काढून टाकले"; the row is gone. The slot meter does not move — a draft never held one |
| ☐ F13a | Look for Remove or Archive on a PENDING, LIVE or PAUSED listing | There is none. `DELETE /api/products/<id>` on one via curl answers **403** "पाठवलेले उत्पादन काढता येत नाही. ते काढायचे असल्यास प्रशासकाशी संपर्क करा." Only an admin gives a slot back (L13) |
| ☐ F14 | `PATCH` **another** seller's product id via curl with your seller token | **404** — and certainly not a successful edit |

---

## 7. Suite G — Customer browsing, search and the shop pages

Profile B as a registered customer.

| ID | What to do | What must happen |
|---|---|---|
| ☐ G1 | Open `/shop` | Products from all three seed sellers: photo (or category picture), name, price, stars only when rated, and an "टोपलीत टाका" / "Add to cart" control. The seller card is on the product and shop pages, not the grid |
| ☐ G2 | Look for `p4` (घरगुती तूप, PENDING) | **Not present** — only LIVE products from ACTIVE, open sellers whose term has not ended |
| ☐ G3 | Search `लोणचे` | आंब्याचे लोणचे matches |
| ☐ G4 | Search `pickle` | Also matches — search covers `nameEn` |
| ☐ G5 | Search `zzzz` | An empty state with words ("अजून उत्पादन नाही"), not a blank screen |
| ☐ G6 | `curl "localhost:4000/api/catalog/products?pincode=413603"` | Only Mangal's products. The app itself no longer filters by pincode — there is no pincode bar on any screen, and all three shops always show |
| ☐ G7 | `curl "localhost:4000/api/catalog/serviceability?pincode=999999"` | 200 with `serviceable: false`, zero counts and a list of nearby villages |
| ☐ G8 | The same with `pincode=12345` | 400, "6 अंकी पिनकोड टाका". In the app, the address form refuses it with "पिनकोड 6 अंकी हवा" |
| ☐ G10 | Open Categories | 14 tiles, "इतर" / "Other" last and without a photograph; each opens its own product list |
| ☐ G11 | Open a product detail | Price, crossed-out MRP when higher, the pack size after the price ("/ 500 ग्रॅम") when set, veg/non-veg mark and stock pill, ingredients (food) or material, the FSSAI number when given, the delivery terms, reviews, and a seller card: shop name, stars "तिच्या सर्व उत्पादनांवरून", village, SMB ID |
| ☐ G12 | Open `p3` (stock 0) | Out of stock is stated in **words** — pill and button both read "संपले आहे" — not only by a colour or a disabled button |
| ☐ G13 | Open `p9` (made to order) | Stock 0 does **not** read as unavailable: the pill reads "शिल्लक आहे" and it can be added up to 20. (No buyer screen says "made to order" — that wording is seller-side only) |
| ☐ G14 | Look for any seller's **phone number** on a public screen, and in the unauthenticated `GET /api/catalog/products/<id>` and `GET /api/sellers/<id>` bodies | Never there — `publicSeller()` is an allow-list. It reaches a signed-in buyer only on her own order and through "Ask about delivery" in the cart (H9) |
| ☐ G14a | On a product page, scroll to "याच दुकानातील आणखी" / "More from this shop" | Up to three of that seller's other newest LIVE products, and a "या दुकानातील सर्व वस्तू पहा" button. A shop with one product shows neither |
| ☐ G14b | Tap that button | `/shop/seller/<id>`: seller card, delivery terms, "या दुकानातील वस्तू (n)" and every LIVE product of hers |
| ☐ G14c | From product A, tap a "More from this shop" card for product B | B's page replaces A's at once. A's page and A's Add button must **never** stand at B's address, even for a moment on slow 4G (devtools → throttle) |
| ☐ G15 | Take a **non-LIVE** product id from a seller's own list (`GET /api/products/mine` with her token — a DRAFT, PENDING or PAUSED one) and fetch it unauthenticated: `curl -i localhost:4000/api/catalog/products/<id>` | **404**, with the same body as a made-up id. Not readable by holding the id, and the 404 does not reveal that the listing exists. Do **not** run this against an id that no longer exists at all — that passes for the wrong reason |
| ☐ G15a | Block that seller in the admin console, then fetch one of her **LIVE** product ids the same way | 404 as well. Blocking removes her from the list *and* her catalogue from id lookups; `publiclyVisible()` in `catalog.routes.ts` is the one rule both paths use, covered by `backend/tests/catalog-visibility.test.ts` |
| ☐ G16 | Close a seller's shop, then reload the catalogue | Her products vanish from the public list |
| ☐ G17 | `curl -X POST localhost:4000/api/catalog/share/<shopSlug>/scan` (slug from `seed.ts`) | 200 `{ok: true, shopSlug}`; an unknown slug is 404 "हे दुकान सापडले नाही". API only — nothing in the app calls it any more, and the public storefront by slug is gone |

### 7.1 Back returns her to where she was

| ID | What to do | What must happen |
|---|---|---|
| ☐ G18 | Scroll far down `/shop`, open a product, press Back | The list is back **at the same product**, in the first frame — no spinner, no jump from the top. Repeat with devtools throttled to Slow 4G |
| ☐ G19 | Do the same from a category list, a shop page and My Orders | Same result on each |
| ☐ G20 | Open a product from the top of the list, i.e. go **forward** | The new screen starts at the top |
| ☐ G21 | Press Back and immediately touch or scroll the page | The restore stops the moment she scrolls herself; it never fights her |
| ☐ G22 | Log out and in as someone else, open the same screens | Nothing from the previous person's session is drawn, even for a frame — the screen cache is cleared when a session ends |

---

## 8. Suite H — Cart and checkout

Profile B. This is the money path — do every row.

| ID | What to do | What must happen |
|---|---|---|
| ☐ H1 | Tap "Add to cart" on a grid card | The control turns into − n + in place, and the cart badge shows the total quantity. (On a product page, Add puts one in and goes straight to the cart) |
| ☐ H2 | Reload | The cart survives (`wb.cart` in localStorage) |
| ☐ H3 | In the cart, press + and − on a line | Line total, the seller's total and the bottom total all update |
| ☐ H3a | Press + on a `p2` line until it stops | + disables at **8** (its stock). On `p9` (made to order) it stops at **20** |
| ☐ H4 | Press − on a line whose quantity is 1 | The line leaves the cart. There is no separate Remove button (on a grid card, the − at quantity 1 is labelled "ही वस्तू काढा") |
| ☐ H5 | With a Sunita product in the cart, open a Mangal product | **Refused, and the cart is untouched.** In place of Add: "तुमच्या टोपलीत सुनीता गृहउद्योग यांच्या वस्तू आहेत. एका वेळी एकाच विक्रेतीकडून खरेदी करता येते. आधीची खरेदी पूर्ण करा किंवा टोपली रिकामी करा." and a "टोपली पहा" / "Open cart" button |
| ☐ H5a | Tap Add on a Mangal grid card instead | The same sentence, as a warning toast. Nothing is added |
| ☐ H5b | Empty the cart (− to 0), then add the Mangal product | Accepted — nothing was ever cleared on her behalf |
| ☐ H6 | Kavita's `p11` × 1 (₹60), in the cart | Warning "किमान ऑर्डर ₹150" and **Continue is disabled**. Via curl the server refuses it too: 409 "कविता गृहउद्योग किमान ऑर्डर ₹150" |
| ☐ H7 | Sunita's `p2` × 1 (₹180) | ₹20 delivery added; total ₹200 |
| ☐ H8 | Sunita's `p2` × 3 (₹540) | Delivery pill "मोफत" / "Free" — free at ₹500 and above, her own promise |
| ☐ H9 | Kavita's items (fee ₹0) | Delivery reads "विक्रेतीला विचारा" / "Ask the seller", **never "free"**, with "डिलिव्हरीचे पैसे विक्रेती सांगतील. ऑर्डर देण्याआधी त्यांना विचारू शकता." Every total reads "एकूण (डिलिव्हरीशिवाय)". Checkout repeats the line. The product and shop pages say "डिलिव्हरी: विक्रेतीला विचारा", not ₹0 |
| ☐ H9a | Press "डिलिव्हरीबद्दल विचारा" / "Ask about delivery" in that cart | Her number appears with "फोन करा" (dialler) and "व्हॉट्सॲप" links. Without a customer token `GET /api/catalog/sellers/<id>/contact` is refused; for a closed shop it is 404 |
| ☐ H10 | Check out with no saved address | The address form **is** the step ("वस्तू कुठे पोहोचवायच्या?"), and "Place order" stays disabled until one is saved. Via curl with no pincode: 400 "पत्ता निवडा" |
| ☐ H11 | Add a new address at checkout | Saved ("पत्ता जतन झाला"), selected, and kept on her account |
| ☐ H12 | Address pincode `413603` for a Sunita-only cart | **A warning, not a refusal**: the shop's name and a line asking her to check with the seller. The order goes through with `outsideArea: true`, and Sunita's order screen says so (I2a) |
| ☐ H12a | Save an address with pincode `560001` (or any `403…`, which is Goa) and select it | A red notice that delivery is in Maharashtra only, and "Place order" is disabled. Via curl: 409 "सध्या महाराष्ट्रातच पोहोचवले जाते" |
| ☐ H13 | Via curl, place one body with **two** `groups` (two sellers) | 201 with **two orders** sharing one `groupId`. The app itself can no longer build such a cart; an old two-seller `wb.cart` still renders grouped by seller |
| ☐ H14 | Choose **COD** ("वस्तू मिळाल्यावर रोख") | Order placed with payment status COD_PENDING |
| ☐ H15 | Choose **UPI** | **No QR and no UTR box at checkout.** An info notice: "विक्रेतीने ऑर्डर स्वीकारल्यावरच पैसे भरायचे आहेत. आत्ता काही भरू नका." The QR appears on the order screen after she accepts (I11) |
| ☐ H17 | Place a UPI order | Payment status **UPI_PENDING**. A `paymentUtr` in the checkout body is ignored |
| ☐ H18 | The confirmation screen `/shop/placed/<id>` | A tick, "ऑर्डर झाले!", the order id, "विक्रेतीला तुमचे ऑर्डर मिळाले आहे. ती लवकरच संपर्क करेल." and two buttons, "ऑर्डर कुठे आहे?" and "वस्तू पहा". No bottom tabs |
| ☐ H19 | Tamper: place an order via curl with `price: 1` on the items | The server re-derives the price from the database. The stored total is the **real** price. (Known gap, 2026-09-28: the server does not cap `qty` against stock — `qty: 999` is accepted; log it) |
| ☐ H20 | Order a **paused / non-LIVE** product via curl | 409 "Product unavailable" (the Marathi body is the generic "काहीतरी चूक झाली. पुन्हा प्रयत्न करा.") |
| ☐ H21 | Order from a **closed** seller via curl | 409 "ही विक्रेती सध्या ऑर्डर घेत नाही". The same for a blocked seller, one whose term has ended, and a closed account |
| ☐ H22 | Place an order with an empty `groups` array | 400 "टोपली रिकामी आहे" |
| ☐ H23 | After ordering, look at the cart | Cleared |

---

## 9. Suite I — The order lifecycle

Profiles A and B side by side, on orders created in Suite H — one COD, one UPI.
State machine: `PLACED → ACCEPTED → PACKED → OUT_FOR_DELIVERY → DELIVERED`.
Five states. DELIVERED is the end — there is no COMPLETED step. Payment is its own
axis, but a UPI order cannot reach PACKED until the seller has confirmed the money.
The buyer sees four stages, not five states.

| ID | What to do | What must happen |
|---|---|---|
| ☐ I1 | The seller's "My Business" home | The new order is in the action queue — the most important widget on the screen. (Known bug, 2026-09-28: an ACCEPTED UPI order still waiting for the buyer's money also sits there, titled as ready to pack, with nothing for her to do — log it if still so) |
| ☐ I2 | Open the order as the seller | Customer name, address, landmark, pincode, items (qty × price), delivery fee, total, and "Call customer" / "Open in Maps". The phone number sits behind the call button |
| ☐ I2a | Open the order placed in H12 (pincode outside her list) | A warning: outside your listed areas, "Pincode 413603. Accept only if you can get there." |
| ☐ I3 | Open the order as the **customer** | The **seller's phone number is visible immediately**, at PLACED, before she accepts, with call and WhatsApp buttons. The status box reads "विक्रेतीच्या होकाराची वाट" |
| ☐ I4 | The buttons offered at PLACED | "Accept order" and "Reject" in the action bar; a quiet "या ग्राहकाची तक्रार करा" link below the content |
| ☐ I5 | Tap Accept | A sheet first: "किती वेळात पोहोचवाल?" with four chips (आज / उद्या / 2 दिवसांत / 3 दिवसांत), a text box with a mic (40 characters at most), and "वेळ न सांगता स्वीकारा". Tapping outside the sheet does **not** accept |
| ☐ I5a | Pick "2 दिवसांत" and accept | Status ACCEPTED. Both order screens show "अपेक्षित वेळ: 2 दिवसांत"; the buyer's box reads "Order confirmed" with the day |
| ☐ I5b | On another order, accept with "वेळ न सांगता स्वीकारा" | Accepted with no estimate, and no empty "expected delivery" line anywhere |
| ☐ I6 | The buttons at ACCEPTED, COD order | Only "तयार आहे" / "Ready to send" in the bar, and a ghost "ऑर्डर रद्द करा" below the content — never in the bar |
| ☐ I7 | Mark packed, then look at the next button | "Out for delivery", and it asks for **confirmation stating the consequence**: "Have you left with the order?" |
| ☐ I8 | Mark out for delivery, then mark delivered | Status DELIVERED |
| ☐ I9 | Look at the screen at DELIVERED | **No further step is offered and none is greyed out below it.** The seller's timeline shows all five states ticked; the buyer's box is green, collapsed, "Delivered" with the day |
| ☐ I10 | A COD order at DELIVERED | Payment status is COD_COLLECTED (check with `GET /api/orders/<id>`) — delivery and collection are the same moment |
| ☐ I13 | `POST /orders/:id/advance` with `to: DELIVERED` from PLACED, via curl | **409** "हा बदल करता येणार नाही" — illegal transition |
| ☐ I14 | Reject an order **without** a reason via curl | **400** — a reason is required |
| ☐ I15 | Reject in the UI | The sheet offers "Out of stock" / "Cannot deliver there" / "Shop closed today". Status REJECTED; the buyer sees "The seller could not take this order" with the reason, and a red line on her tracker |
| ☐ I16 | The buttons at REJECTED, CANCELLED and DELIVERED | None |
| ☐ I18 | `GET /orders/:id` with a **third** party's token | **403** — an order is visible only to its two parties |
| ☐ I19 | `POST /orders/:id/advance` as a different seller | 404 |
| ☐ I20 | The customer's My Orders | Three tabs — "चालू", "पूर्ण झालेले", "रद्द झालेले" (a rejected order is under cancelled) — each with a count, newest first. The seller's list has four: needs your attention, accepted, delivered, cancelled |
| ☐ I20a | On the buyer's order screen, the order number | "ऑर्डर क्र." with a copy icon; tapping it says "ऑर्डर क्रमांक कॉपी झाला". Tapping the status box opens the four-stage tracker |
| ☐ I21 | Every status chip | Colour **plus** icon **plus** word. Never colour alone |
| ☐ I22 | The notification bell, both sides | The count is one per **order**, capped at "9+"; opening the updates list clears it; the last-seen mark survives a reload |
| ☐ I23 | The updates list after an order has been accepted, packed and sent | **One row** for the order, named after what is in it, wearing its current status pill — not four rows. Only the other side's actions appear |

### 9.1 UPI: the buyer pays after the seller accepts

| ID | What to do | What must happen |
|---|---|---|
| ☐ I11 | The UPI order at PLACED, both sides | The buyer sees "आधी विक्रेती ठरवतील" and no QR. The seller sees "तुम्ही स्वीकारल्यानंतर {name} पैसे भरतील." |
| ☐ I11a | The seller accepts | Her bar goes empty — no "Ready to send" — and she reads "{name} यांच्या पैशांची वाट पाहत आहे". Via curl, advancing to PACKED is **409** "पैसे आल्याची खात्री केल्यावरच पुढे जा" |
| ☐ I11b | The buyer's order screen now | "आता पैसे भरा": the amount printed as "भरायची रक्कम ₹…", a QR carrying that amount, the UPI ID with a copy icon (the ID wraps beside the icon, never pushed under it), the numbered screenshot-and-scan steps, and a UTR box. There is no "Pay" button that opens a UPI app |
| ☐ I11c | Type an 11-digit UTR | "पैसे भरले, पुढे पाठवा" stays disabled. Via curl: 400 "UTR 12 अंकी असतो, तुम्ही 11 अंक टाकले. UPI ॲपमध्ये तो पुन्हा पहा" |
| ☐ I11d | Via curl, submit on this order a UTR already used on **another** order | 409 "हा क्रमांक दुसऱ्या ऑर्डरसाठी वापरला आहे. …" |
| ☐ I11e | Submit a valid 12-digit UTR | The buyer sees "विक्रेती पैसे आले का ते तपासत आहेत" with the UTR. A second submit is 409 |
| ☐ I12 | The seller's side at UPI_SUBMITTED | The order is in her action queue as "Did the money arrive?", showing the UTR and a "Yes, money received" button |
| ☐ I12a | She confirms | Payment status UPI_CONFIRMED, as a **separate** action from advancing the order; "Ready to send" appears. The buyer's UPI pill turns green |
| ☐ I12b | Via curl, `POST /api/orders/<id>/pay` on a PLACED order | 409 "या ऑर्डरसाठी आत्ता पैसे भरायचे नाहीत" |

### 9.2 Calling an order off, and the refund

| ID | What to do | What must happen |
|---|---|---|
| ☐ I17 | As the buyer, on a PLACED order, tap "ऑर्डर रद्द करा" | Step 1: "नक्की रद्द करायचे का?" — the seller has not accepted yet, nothing has been paid, and she would need a new order later; "ऑर्डर ठेवा" or "हो, नक्की रद्द करा" |
| ☐ I17a | Step 2 | "ऑर्डर का रद्द करत आहात?" with six reasons. "Another reason" asks for typed words, and Next stays disabled below 5 characters |
| ☐ I17b | Step 3, "हो, रद्द करा" | The order is CANCELLED. Both screens say who stopped it and why, each **in its reader's language** (switch one side to English to check). The seller hears it on the updates list |
| ☐ I17c | As the buyer, open an ACCEPTED order | No cancel button: "विक्रेतीने ऑर्डर स्वीकारले आहे. आता रद्द करायचे असल्यास विक्रेतीला फोन करा." Via curl, 409 with the same words |
| ☐ I17d | As the seller, cancel an ACCEPTED COD order | The same three steps worded for her, with seven reasons ("The customer asked to cancel" among them), then a **fourth** screen: "Took any money from the customer? Return it" and "The app cannot refund anyone. …" It closes only on "समजले" — a tap outside does nothing |
| ☐ I17e | As the seller, cancel a UPI order whose buyer submitted a UTR | Step 3 adds "The customer says they have paid ₹{total} …"; the refund screen says to check and send it back, with a call button. The cancelled order keeps a refund notice on her screen, and the buyer reads that the seller must send the ₹{total} back |
| ☐ I17f | Via curl, cancel a DELIVERED order, or a PLACED one as the seller | 409 "या टप्प्यावर हे ऑर्डर रद्द करता येणार नाही" — before acceptance she has Reject |
| ☐ I17g | Via curl, cancel with reason `other` and a 3-character note | 400 "कारण थोडक्यात लिहा" |

---

## 10. Suite J — Customer profile and addresses

Profile B.

| ID | What to do | What must happen |
|---|---|---|
| ☐ J1 | Open the profile | Top to bottom: name card with +91 phone and Edit, "My orders", saved addresses, the walkthrough menu, a "आमच्याशी बोला" help card (WhatsApp, call, "तक्रार नोंदवा"), "धोरणे आणि अटी", the language picker, Log out, and last, well apart from Log out, a quiet "खाते बंद करणे" card |
| ☐ J2 | Change the name | Saved; the next order carries the new name |
| ☐ J3 | Save a name that is only spaces | The save button stays disabled; via curl, 400 "नाव टाका" |
| ☐ J4 | Add an address | Appears in the list and is selectable at checkout. The first address becomes the default |
| ☐ J5 | Add an address with pincode `1234` | Refused — "पिनकोड 6 अंकी हवा" |
| ☐ J6 | Edit only an address's line | Saved; the pincode is untouched |
| ☐ J7 | Set a different address as default | Only one default at a time; checkout preselects it (unless an address matches a pincode remembered from an older build) |
| ☐ J8 | Delete an address | A confirmation naming the address first; then gone from the list and from checkout. Deleting the default promotes the next one |
| ☐ J9 | Delete an id that does not exist, via curl | 404 |
| ☐ J10 | `GET /api/customers/me` with a **different** customer's token | You get that token's own customer, never yours. Confirm no path reads someone else's addresses |
| ☐ J11 | Log out and back in | The name and addresses are still there — they live on the server, not in localStorage |

---

## 11. Suite K — The rest of the seller app

Profile A.

| ID | What to do | What must happen |
|---|---|---|
| ☐ K1 | My Business: the shop open/closed toggle | One tap at the top of the screen, with "Shop is open" / "Shop is closed" in words beside the icon. Closing it removes her products from the public catalogue. With her term ended, the toggle is replaced by "Shop closed - subscription ended" |
| ☐ K2 | The slot meter card | Used / total matches the products list — PENDING, LIVE and PAUSED count; drafts do not |
| ☐ K3 | The bottom navigation | Exactly **four** tabs, one level deep (seller: My Business / Upload / Profile / Help; buyer: Explore / Categories / Cart / My Profile) |
| ☐ K4 | Payment QR screen (`/seller/payment`): enter an invalid UPI id | Save stays disabled |
| ☐ K4a | Edit profile: change the UPI ID to `sunita@ybll` and save | 400: "\"@ybll\" तपासा. तुम्हाला \"@ybl\" म्हणायचे आहे का?" |
| ☐ K5 | On the Payment QR screen, save a valid UPI id | Saved, `upiQrReady` set; the screen draws a QR from the ID. (Her bank's QR image is uploaded from Edit profile, "तुमचा पेमेंट QR (ऐच्छिक)", not here) |
| ☐ K6 | A buyer's accepted UPI order for her (I11b) | The QR the buyer sees is generated **from her UPI ID and carries the exact amount and order id** — never an uploaded image, which cannot carry the amount. With no UPI ID the buyer reads "This seller has not added a UPI QR yet. Please choose cash on delivery." |
| ☐ K6a | Via curl, `PATCH /api/sellers/me` with a `photo` or `upiQrUrl` that is not this Cloudinary account's upload | 400 — a pasted URL cannot stand in for one the picker uploaded |
| ☐ K7 | Edit profile: age 17 | Refused (18–90) |
| ☐ K8 | Edit profile: delivery fee `-500` via curl | Refused by the server, not only by the form: 400, `fields.deliveryFee` |
| ☐ K9 | Edit profile: a pincode of `12ab56` via curl | 400 "6 अंकी पिनकोड टाका" |
| ☐ K10 | Edit profile: try to change `status`, `packsApproved` or `womenBizId` via curl | Ignored — they are not on the allow-list |
| ☐ K11 | My Buyers | Every buyer with order count, total bought, last order and a "Repeat buyer" pill above one order. Rejected and cancelled orders are **not** counted as sales |
| ☐ K12 | Growth screen | Her numbers render; with no DELIVERED order yet it says there is not enough information, and does not crash. There is no Share button |
| ☐ K13 | Help & Training → replay a walkthrough | The tour runs on the real screen and rings the **real** control, not a drawn copy |
| ☐ K14 | Open each of the four tabs for the first time in a fresh browser | Each screen explains itself once, then never again (skipping counts as seen) |
| ☐ K15 | Finish a tour, log out, log back in | The tour does **not** replay — `wb.tours` is per device, not per account |
| ☐ K16 | Run a tour whose target control is absent (an empty cart, a gated wizard) | Steps whose control is missing are dropped; if none is found, the steps show dimmed without a ring. No crash |
| ☐ K17 | Voice input: tap a mic on a text field in Chrome | It dictates into **that** field only, in the app's language, and the keyboard is still there |
| ☐ K18 | Open the same screen in a browser with no Web Speech API | The mic simply does not render. Nothing is broken or greyed out |
| ☐ K19 | Updates screen ("सूचना") | One row per order, plus admin decisions (payment approved or rejected, slots granted or revoked, product approved or rejected with its reason, blocked, unblocked, renewed) and the subscription reminder — in one list, split into "New" and "Earlier" only when both exist |
| ☐ K20 | Admin blocks her, then reload her app | She is **told** she is blocked, on a red notice at the top of My Business, with the reason when the admin gave one. Not silently unable to sell |
| ☐ K21 | Admin unblocks her | She is notified ("Your shop is open again") and can sell again |
| ☐ K22 | Her reviews (`/seller/reviews`, and the card on My Business) | Her rating is her products' ratings taken together; each review names its product; each has a report link (S4). With none: an empty state in words |
| ☐ K23 | Help screen | The "आमच्याशी बोला" card (WhatsApp, call 9420488874, "तक्रार नोंदवा") and, last, "फोनवर सूचना येत नसतील तर" with the Xiaomi / Oppo / Vivo / Realme battery advice |
| ☐ K24 | Her profile | "धोरणे आणि अटी", the language picker, Log out, and at the very bottom — nowhere near Log out — the quiet "खाते बंद करणे" card (Suite T) |

---

## 12. Suite L — Admin console

Profile C at `:5174`. Reports, complaints, blocking a buyer and closing an account
from the console are in Suites S and T.

| ID | What to do | What must happen |
|---|---|---|
| ☐ L1 | Home and Today | Three action tiles with counts — "Payments waiting", "Products to review", "Orders stuck". A tile at 0 still shows, dimmed and not clickable. The sidebar carries the same three counts as badges |
| ☐ L2 | Click the pending-payments tile | Navigates to Payments |
| ☐ L3 | Today: the health stats | Active sellers, total sellers, new this week, orders today/week, ₹ earned month/total, women with a first earning, subscription income, payments approved. Home adds "Subscriptions ending this week" and "Sellers with expired subscriptions". "Active sellers" counts only shops a buyer can reach today — an expired term is not active |
| ☐ L4 | Today: the two donut charts | Earning spread and readiness spread render with a centre label. No NaN, no empty ring on seeded data |
| ☐ L5 | With everything handled | "Nothing waiting" / "No approvals are pending right now." — not a blank panel |
| ☐ L6 | Payments queue, sorted "Oldest first" | Three PENDING rows, each with a "Waiting …" pill computed in the console: minutes under an hour, hours under 48, then days. The ~50h one reads "Waiting 2d" in **red**. The default sort is newest first, and the choice is remembered |
| ☐ L6a | Leave the Payments screen open for over 30 minutes | The waiting times move on their own, without a reload |
| ☐ L7 | The duplicate-UTR row | A red "Same UTR again" pill |
| ☐ L7a | Open a row that has a screenshot (submit one from Suite D first) | "View screenshot" opens it large in a `<dialog>` beside the UTR, the stated payment time and the amount. The seeded rows have neither, and say so ("No screenshot", "No payment time given") |
| ☐ L8 | Try to approve with fewer than three boxes ticked (UTR matches, date and time match, money on the statement) | Approve stays disabled ("Tick all three checks to approve"). Via curl without all three in `checks`: **400** |
| ☐ L8a | Tick all three and approve | Toast "Payment approved. She now has 5 slots."; the row leaves the queue; she becomes ACTIVE with +5 slots and a six-month term. A second approve of the same id is **409** |
| ☐ L8b | Approve a **renewal** (pill "Renewal") | No slots added; her end date moves six months — from the current end if paid in the reminder week, from the approval if already paused |
| ☐ L9 | Reject a payment in the console with no reason | The form refuses it. (Known gap, 2026-09-28: via curl the server does **not** refuse it — a missing reason defaults to "UTR did not match the bank statement", and an already-APPROVED payment can be rejected too. Log both) |
| ☐ L10 | Products screen, "To review" tab | The seeded `p4` is there. The tabs are To review / Published / Reported — there is no Rejected tab |
| ☐ L11 | "Publish" a product | It goes LIVE, appears in the customer catalogue, and the seller is notified **by product name** |
| ☐ L12 | Reject a product with no reason, via curl | 400 "नाकारण्याचे कारण लिहा" |
| ☐ L13 | Reject a pending product with a reason | The form warns first: "Rejecting removes this product straight away. Her slot is freed and she is told the reason." Then the product is **deleted at once** — gone from both lists, its photo destroyed, her slot free (5 slots, 3 sent in, the third refused, leaves 3 free). She reads the reason on a notice in her updates list. There is no 48-hour grace and no countdown |
| ☐ L13a | On the Published tab (or her page's listings), "Take down" a LIVE product with a reason | The same: deleted, slot freed, reason sent to her. This is the only way a seller gets a slot back from a submitted listing. (Known gap, 2026-09-28: a PAUSED listing appears in no tab and cannot be taken down from the console) |
| ☐ L14 | Reject the **same** id again via curl | 404 "हे उत्पादन सापडले नाही" — there is nothing left to reject |
| ☐ L16 | Set a product's `status` to `REJECTED` by hand in `db.json` (a row from the old 48-hour rule), restart | It is swept at boot. `purgeRejected()` also runs on the 15-minute timer and on her `GET /products/mine` |
| ☐ L17 | Sellers screen | Every seller with status, a subscription pill when ACTIVE ("Subscribed until …", amber "Ends in n days", red "Expired", or "No subscription yet"), SMB id, village, phone, slot usage, packs, product count (drafts included), digital readiness, and UPI with a Copy button |
| ☐ L17a | The Sellers filter and sort menus | Filter: all / ending within 7 days / expired / Reported (N), plus a search box. Sort: newest, oldest, name A→Z and Z→A (Marathi and English names each collate properly), highest earnings, most packs. The choice survives a reload. Orders, Products and Payments each have their own Sort by menu |
| ☐ L18 | Block a seller with a reason | Status BLOCKED, `blockedAt` and reason stamped, and she is notified. Her page reads "This account was blocked on …" with the reason |
| ☐ L19 | Grant slots (1, 2 or 3 packs) | +5 per pack, and she is notified in slots. A seller with no term gets six months; an existing term is never extended — time is paid |
| ☐ L20 | Revoke more slots than she has spare | 409 "She is using {used} slots; that would leave {n}" |
| ☐ L20a | On her page, "₹ Record payment": choose New pack or Renewal, Cash, today's date, and save | 201. The payment appears in Payments already APPROVED, with an info pill "Recorded by staff · Cash", and a renewal moves her end date exactly as the queue does. A future time or one older than 7 days is 400; UPI needs a valid 12-digit UTR (a UTR already on any payment is 409); a pending payment of hers in the queue is 409 — decide that one first. The button is hidden for a closed account |
| ☐ L21 | Orders screen: filter by status and pincode, and sort | Each narrows the list; newest first by default; each row shows the shop name and a masked buyer. A banner says the console is read-only for orders. (There is no seller filter in the UI; `?sellerId=` is API only) |
| ☐ L21a | Open an order from far down the list | The detail opens as a `<dialog>` over the list, not below the fold, and shows the SMB id; Esc and a backdrop click close it. If the order ended, it names who stopped it and why |
| ☐ L22 | Impact screen | Per-village women count and ₹ earned. Only DELIVERED orders count as earnings |
| ☐ L23 | The console's language toggle | Both languages complete; no raw `t()` keys on screen. (Known bug, 2026-09-28: the Complaints subject pill prints `help.subject.payment` etc. in both languages, and order statuses are shown untranslated — log them if still so) |
| ☐ L24 | Idle for over 8 hours, or edit the session's last-seen time in `db.json` | The admin session has expired — 8h idle, far shorter than the seller's 15 days. The console returns to sign-in; no panel keeps re-requesting behind it |
| ☐ L25 | The admin logo | The same portrait mark as the seller app, favicon included, with **no** extra ring or background |
| ☐ L26 | Reviews screen: filter "Low ratings (1 or 2 stars)", then "Hidden reviews" | Each narrows the list; each row names its product and seller (needs reviews from Suite R) |
| ☐ L27 | Hide a review with an empty reason | Refused ("Write why it is being hidden"); via curl, 400. With a reason: "Review hidden"; it leaves the product's page and average, and "Show again" restores it |
| ☐ L28 | `npm run admin -- pending`, then `npm run admin -- approve <id> --verified` | The CLI lists the queue and approves; without `--verified` it refuses, and there is no `approve all`. (Known gap, 2026-09-28: `pending` prints "waiting 0h" for every row) |

---

## 13. Suite M — Language, design rules and accessibility

Run these across both apps.

| ID | What to do | What must happen |
|---|---|---|
| ☐ M1 | Walk every screen in Marathi | No English leaks except brand names and Latin digits |
| ☐ M2 | Walk every screen in English | No Devanagari leaks — **including inside input placeholders** |
| ☐ M3 | Look for a string rendered as its own key (e.g. `prod.add`) | None. A missing key renders as its own name, visibly, in both languages |
| ☐ M4 | Every status chip in both apps | Colour + icon + word |
| ☐ M5 | Every confirmation dialog | States the consequence. No bare "Are you sure?" |
| ☐ M6 | Every price, count and pincode | Latin digits |
| ☐ M7 | Zoom to 200% | Nothing is clipped or unreachable |
| ☐ M8 | Narrow to 320px | No horizontal scroll; full-width buttons still at `--btn-h` (54px today), small and icon buttons at the 44px floor |
| ☐ M9 | Tab through a form with the keyboard | Focus is visible and correctly ordered |
| ☐ M10 | Devtools → Network, hard reload | No web-font requests on any screen |
| ☐ M11 | Change one colour in `theme.css`'s `:root` block, reload | The app re-themes from that one block. (Known exceptions, 2026-09-28: the QR's maroon, the landing illustration's fills and ~20 literal `#fff` do not follow — record, don't fail) |
| ☐ M12 | Look for emoji anywhere in the three apps | **None**, not even as data: a seller is her photo or her initials, veg/non-veg is the CSS `VegMark`, a product with no photo shows its category photograph or a product icon, a done screen shows a green tick icon. `Product.emoji` is stored but never drawn |
| ☐ M13 | Try to select text by long-press or drag in the seller and buyer app | Text selection is off in both apps; inputs and the UPI ID beside a copy button still select. The admin console's text boxes cannot be resized |
| ☐ M14 | Every icon-only control (shop open/close toggle, pause on a product row, copy) | Each carries a word beside it or an accessible label. (Known gap, 2026-09-28: the pause/play button on a My Products row is icon-only — log it) |

---

## 14. Suite N — Security and API-level negatives

`curl` or any REST client against `:4000`. These are the tests the UI cannot do.

| ID | What to do | What must happen |
|---|---|---|
| ☐ N1 | Call any `/api/admin/*` route with **no** token | 401 |
| ☐ N2 | Call `/api/admin/payments` with a **seller** token | 403 |
| ☐ N3 | Call `/api/products/mine` with a **customer** token | 403 |
| ☐ N4 | Call `/api/catalog/products` with no token | **200** — public routes stay public; `attachAuth` never rejects |
| ☐ N5 | Base64url-decode a session token and read the payload | It carries `{sid, role, iat}` and **no identity**. No sellerId, no phone |
| ☐ N6 | Change `role` inside the payload and re-send | Rejected — the HMAC no longer matches |
| ☐ N7 | Keep the signature, swap in another `sid` | Rejected |
| ☐ N8 | Delete that session's row from `sessions` in `db.json`, restart, reuse the token | 401 immediately — "her phone was stolen" is real |
| ☐ N9 | Present a **registration ticket** as a session token | Rejected — signatures are domain-separated by purpose |
| ☐ N10 | `GET /api/auth/sessions` as a seller | Only her own live sessions |
| ☐ N11 | `DELETE /api/auth/sessions/:id` for **someone else's** session | **404** "हे सत्र सापडले नाही" — refused, and without confirming the session exists |
| ☐ N12 | Revoke one of your own sessions from another device | That device gets a 401 on its next call and is signed out |
| ☐ N13 | `POST /api/uploads/signature` with no token and no ticket | 401 |
| ☐ N14 | Inspect a signature response | Signature, timestamp and folder — **never** the Cloudinary API secret |
| ☐ N15 | Devtools → Network while uploading a photo | The bytes go **direct to Cloudinary**, not through `:4000` |
| ☐ N16 | `POST /api/uploads/delete` as a customer | 403 |
| ☐ N17 | Send a 3MB JSON body to `/api/auth/otp/send` | **413** — the auth router caps bodies at 8kb |
| ☐ N18 | 301 requests from one IP in a minute | 429 from the global backstop |
| ☐ N19 | Behind a proxy, confirm `trust proxy` is in effect | Rate limits key on the real client IP, not one shared address |
| ☐ N20 | Read the auth event log in `db.json` | Phones are **masked**, IPs are **hashed** — the log is not itself worth stealing. (Session rows still hold the plain phone; that is the account, not the log) |
| ☐ N21 | Call the API from an origin not in `CORS_ORIGIN` | Blocked |
| ☐ N22 | Set `CORS_ORIGIN` to two comma-separated origins | **Both** are allowed — it is parsed into a list, not handed over as one joined string |
| ☐ N23 | `POST /api/dev/reset` with and without `ALLOW_DEV_RESET=true`, in development and with `NODE_ENV=production` | 404 by default **even in development**; 200 only in development with the flag set (the boot banner warns); still 404 in production with the flag |
| ☐ N24 | Boot with `NODE_ENV=production` and **no** `SESSION_SECRET` | The server **refuses to boot** |
| ☐ N25 | Boot with `NODE_ENV=production` and no SMS provider | Refuses to boot — demo OTP cannot run in production |
| ☐ N26 | Boot with `NODE_ENV=production` and `SEED_DEMO_DATA=true` | Refuses to boot — invented sellers must never reach real customers |
| ☐ N27 | Boot with `NODE_ENV=production` and Firestore unreachable | Refuses to boot: "Firestore could not be loaded … Refusing to start on an empty database." (In development it falls back to the JSON file — O4) |
| ☐ N28 | `POST /api/push/token` 11 times in an hour on one session | The 11th is 429 |
| ☐ N29 | `GET /api/catalog/products/<id>` and `GET /api/sellers/<id>` unauthenticated | The seller object carries only the `PublicSeller` allow-list — name, photo, shop, SMB id, village, delivery terms, pincodes, UPI ID/QR and rating. No phone, notices, block reason or readiness answers |

---

## 15. Suite O — Degraded modes and resilience

| ID | What to do | What must happen |
|---|---|---|
| ☐ O1 | Boot with a completely empty `.env` | JSON-file database, demo OTP, no Cloudinary, `Push  off`, CORS any origin, and a warning that `SESSION_SECRET` is using the development key. The app is fully walkable and the banner says exactly this. (The banner's "Images off - emoji only" wording is stale: a listing without a photo shows its category photograph) |
| ☐ O2 | Boot with an **empty** database and `SEED_DEMO_DATA` unset | It stays empty. No invented sellers ever appear in front of a real customer |
| ☐ O3 | Boot with `SEED_DEMO_DATA=true` on an empty database, in development | The seed data appears. (In production the server refuses to boot — N26) |
| ☐ O4 | Boot with **wrong** Firebase credentials, in development | It falls back to the JSON file and prints `[firestore] connection failed:` and `[firestore] falling back to backend/data/db.json - writes will NOT reach Firestore` before the banner. Reads and writes agree — neither silently uses the other store. (Known gap, 2026-09-28: the banner below still says `Database Firestore` and push stays wired — trust the two error lines, not the banner.) In production it refuses to boot (N27) |
| ☐ O5 | With Firestore on, make several writes in under a second (advance three orders) | They coalesce into one batched write (~400ms) — one `[firestore] wrote N, deleted M` line — carrying only the changed documents. (In JSON mode every `save()` writes `db.json` at once; there is nothing to coalesce) |
| ☐ O6 | Kill the API mid-session and restart it | The frontend shows "सर्व्हरशी संपर्क होत नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.", not a white screen. Sessions survive the restart |
| ☐ O7 | Go offline in devtools on any screen | A full-screen notice covers the app at once: "इंटरनेट बंद आहे", "मोबाइल डेटा किंवा वाय-फाय चालू करा. …", "तुम्ही भरलेली माहिती जागीच आहे." and "पुन्हा प्रयत्न करा". Nothing underneath can be tapped |
| ☐ O7a | Stay offline and tap "पुन्हा प्रयत्न करा" | "तपासत आहे..." for a moment, then "अजूनही इंटरनेट नाही. थोड्या वेळाने पुन्हा प्रयत्न करा." |
| ☐ O8 | Come back online | The notice leaves by itself and she carries on where she was, with what she had typed still there |
| ☐ O9 | Every API failure you can provoke | The response is `{ error, messageMr, fields? }` and the **Marathi** message is what the user sees |
| ☐ O10 | Confirm the deployment is pinned to one API instance | Two instances each hold their own in-memory snapshot and silently overwrite each other. Autoscaling must stay off |
| ☐ O11 | Delete a seller in the Firebase console while the API is running, then use her account | She still works, on the data the API loaded at boot. **This is the architecture, not a bug** — the whole dataset is read once at startup and never re-read |
| ☐ O12 | After O11, restart the API and try again | Now she is gone. A restart is the only thing that picks up an out-of-band edit |
| ☐ O13 | After O11, change something about that seller *before* restarting (edit her profile, take an order) | The document is **recreated** in Firestore: the diffed write sees a record that differs from the boot snapshot and sends it. Never edit data in the console against a running API |
| ☐ O14 | With Firestore on and more than 5 documents in a collection, cause a persist that would delete more than half of it (e.g. `npm run purge:demo -- --commit` on a mostly-demo database, without the override) | The write is **refused**: `[firestore] REFUSED to delete x/y docs in <collection>`, and the documents stay. `ALLOW_BULK_DELETE=true` on that one command is the only override |
| ☐ O15 | Make Firestore refuse a write (revoke the key briefly) | The write is retried every 60 seconds and lands once the key works again |

---

## 16. Suite P — Android APK (React Native WebView)

Only if you are testing the packaged build. The APK loads the deployed site
(`docs/DEPLOY.md` §6), so run this after the Vercel deploy you mean to check.

| ID | What to do | What must happen |
|---|---|---|
| ☐ P1 | Install the APK and open it | The deployed site loads, the same build as the web |
| ☐ P2 | Turn off the network and open it | No English error dialog and no raw `net::ERR_…` text — that screen is the wrapper's own (`renderError` in the SMB_android repo). Nothing is bundled into the APK, so it cannot show the shop offline |
| ☐ P2a | Open the app online, then turn the network off | The site's own "इंटरनेट बंद आहे" screen (O7) covers it; turning the network back on returns her to where she was |
| ☐ P3 | Deploy a visible change to `frontend/`, close the app fully and reopen it | The change is there without reinstalling the APK |
| ☐ P4 | Android hardware Back on a seller screen | Same behaviour as browser Back, and it never signs her out |
| ☐ P5 | The photo picker | Opens the **gallery**. There is no camera capture |
| ☐ P6 | Press the mic on a text field | Android asks for the microphone once; what she says fills the field |
| ☐ P7 | Marathi text | Renders from Android's Noto Sans Devanagari, with nothing downloaded |
| ☐ P8 | As a buyer with an accepted UPI order, copy the seller's UPI ID on the order screen, switch to PhonePe, paste, come back | The paste is the exact ID. On return, "पैसे भरून झाले का? खाली 12 अंकी UTR नंबर टाका." and the UTR box is scrolled into view and focused |
| ☐ P8a | Scroll deep into the catalogue, open a product, press hardware Back | The list comes back at the same place (G18) — Back in the APK is `history.back()`, which keeps the scroll memory |
| ☐ P9 | Tap a call button and a WhatsApp help button | The phone dialler and WhatsApp open, not a web page inside the app |
| ☐ P9a | Close the app on a product page and reopen it | It reopens on her last page (allow-listed routes only); a notification tap outranks the saved page |

### 16.1 No ₹50 inside the APK

Google Play forbids pointing an in-app purchase at another way to pay, so inside the
APK the seller's side shows her registration status and never the price. To check it
in a desktop browser, inject `window.ReactNativeWebView = { postMessage: m => console.log('[RNWV]', m) }`
**before the bundle loads** (a DevTools local override of `index.html`, or a
document-start userscript) and reload — defining it in the console after load
changes nothing, because `inApk()` is read once.

| ID | What to do | What must happen |
|---|---|---|
| ☐ P10 | As a REGISTERED seller, open `/seller/subscription` | "माझी नोंदणी": "तुमचे दुकान अजून सुरू झालेले नाही" and that the office switches the shop on. **No price, no QR, no UPI ID, no UTR form** — only a "मदत" button |
| ☐ P11 | Open `/seller/waiting` | Redirected to `/seller/subscription` |
| ☐ P12 | As an ACTIVE seller: the slot card, the slots-full screen, a subscription reminder, the registration done screen, the close-account sheet | Every button and line reads its no-price twin — "माझी नोंदणी", "नोंदणीची माहिती पहा", "कार्यालयाने तुमचे दुकान सुरू केल्यावर तुम्ही 5 उत्पादने टाकू शकाल." — and no "₹50" or "50 रुपये" appears anywhere on her side. (Known leak, 2026-09-28: the server's 402 "सर्व जागा भरल्या आहेत. आणखी 5 जागांसाठी 50 रुपये भरा." and the expired-term 403 have no twin and would show as sent — try to provoke them and log it) |
| ☐ P13 | Staff record her desk payment with "₹ Record payment" (L20a) | Her status screen switches on, or her end date moves, without her ever seeing a pay screen |
| ☐ P14 | The same screens in an ordinary browser | Unchanged: the ₹50 pay screen and queue are still there for the website |

Deep links into a shop (App Links + the Play Install Referrer API) are not
built yet, so there is nothing to test there.

---

## 17. Suite Q — Push notifications (APK)

Only on a real phone with a build that carries `expo-notifications` and
`google-services.json` (`docs/DEPLOY.md` §6, "Push notifications"), against a
backend deployment with `FIREBASE_*` credentials set — without them the boot
banner prints `Push  off` and there is nothing here to see. A second phone or
browser profile is needed to act as the other side of each order.

| ID | What to do | What must happen |
|---|---|---|
| ☐ Q1 | Sign in as a seller or a buyer inside the APK | Android's permission prompt appears now, not earlier on the landing page to a signed-out visitor |
| ☐ Q1a | Refuse the permission | A card just above the bottom tabs: "फोनवर सूचना बंद आहेत", "तुमच्या ऑर्डरबद्दल फोनवर सूचना येणार नाहीत. फोनच्या सेटिंगमध्ये या ॲपसाठी सूचना चालू करा." with "सेटिंग उघडा" and "नंतर करते" |
| ☐ Q1b | Tap "सेटिंग उघडा" | Android's notification settings for the app open |
| ☐ Q1c | Tap "नंतर करते" | The card hides for the rest of this launch (it is remembered in `sessionStorage`, `wb.pushOffLater`). A wrapper build that does not call `window.__smbPushStatus(false)` never reports a refusal, so there the card never shows |
| ☐ Q2 | With that seller signed in, place an order for her from a second device or browser — once with the app in the foreground, once backgrounded, once fully closed (swiped away) | Each time, "नवीन ऑर्डर आले आहे" arrives in the notification tray, with sound |
| ☐ Q3 | Tap the notification once from a fully closed app, and once from a running one | Both taps open that order's screen, `/seller/orders/:id` |
| ☐ Q4 | As the buyer, have the seller walk the order through accept, pack, send out and deliver (or reject); then switch the app's language to English and repeat with another order | A notification arrives for every step, in Marathi first and in English after the switch |
| ☐ Q5 | Log out on the phone, confirm nothing more arrives, then sign in as a different seller or buyer on the same phone | Nothing arrives to the logged-out session; only the newly signed-in person's notifications arrive afterward |
| ☐ Q6 | Repeat Q2–Q3 on at least one Xiaomi, Oppo, Vivo or Realme phone, with Autostart allowed and battery use set to "No restrictions" | Notifications still arrive with the app fully closed |
| ☐ Q7 | As the buyer, cancel a PLACED order | The seller gets "ग्राहकाने ऑर्डर रद्द केले". The buyer, who cancelled, gets nothing |
| ☐ Q8 | As the buyer, submit a UTR on an accepted UPI order | The seller gets "ग्राहकाने या ऑर्डरसाठी ₹{total} भरल्याचे कळवले आहे" |
| ☐ Q9 | Admin publishes one of her listings | The seller gets "तुमचे उत्पादन मंजूर झाले आणि आता दिसत आहे"; a tap opens her products |
| ☐ Q10 | Admin approves her payment or records one (on the APK) | The line names slots, never the ₹50: "तुमच्या दुकानाला {n} नवीन जागा मिळाल्या" |
| ☐ Q11 | Close the account on the phone (Suite T) | Nothing more arrives — every session was revoked with the close |
| ☐ Q12 | The seller's Help screen | The last card, "फोनवर सूचना येत नसतील तर", gives the settings and battery advice for Xiaomi, Oppo, Vivo and Realme |

---

## 18. Suite R — Reviews and the rating gate

Profiles A and B, and C for the admin half. The seed has **no** reviews, and the seeded
orders belong to other customer ids, so deliver fresh orders to Profile B first.

| ID | What to do | What must happen |
|---|---|---|
| ☐ R1 | Deliver an order to Profile B (I8), then use the buyer app | "मिळालेल्या वस्तूंना तारे द्या" covers the **whole** customer app, bottom tabs included, with no close button. Nothing behind it can be tapped |
| ☐ R2 | Look at the gate | One card per distinct product on the order (a product listed twice is rated once); five stars, each row printing its number **and a word** ("खूप वाईट" … "खूप छान"); an optional comment of up to 500 characters |
| ☐ R3 | Rate only one of two products | "अभिप्राय पाठवा" stays disabled with "पाठवण्यासाठी प्रत्येक वस्तूला तारे द्या." |
| ☐ R4 | Rate every product and send | "अभिप्रायाबद्दल धन्यवाद"; the gate lifts, or shows the next unrated delivered order |
| ☐ R5 | Via curl, `POST /api/orders` while a delivered order inside 30 days is unrated | **409** "आधी मिळालेल्या वस्तूंना तारे द्या" with `toRate` |
| ☐ R6 | Age a delivered, unrated order past 30 days in `db.json`, restart | It is never asked about again |
| ☐ R7 | Via curl, `POST /api/orders/<id>/review` on an order that is not DELIVERED | 409 — no order, no review |
| ☐ R8 | The buyer's order screen after rating | "तुम्ही दिलेले अभिप्राय" with a "अभिप्राय बदला" button inside the window; changing replaces that product's review on that order rather than adding one |
| ☐ R9 | The product page, as another buyer | The review shows under "ग्राहकांचे अभिप्राय" with the reviewer's **first name only**, and the product card now shows stars. A product nobody reviewed says "या उत्पादनाला अजून कोणीही अभिप्राय दिलेला नाही." |
| ☐ R10 | The seller card on that product page | Her rating is all her products' reviews taken together, "तिच्या सर्व उत्पादनांवरून" — a product rated often weighs more |
| ☐ R11 | `GET /api/catalog/products/<id>/reviews` for a PAUSED product | 404, the same as the product itself |
| ☐ R12 | Admin hides the review with a reason (L27) | It leaves the product's list and average; the seller stops seeing it; the buyer sees "हा अभिप्राय प्रशासनाने लपवला आहे. तो इतर कोणालाही दिसत नाही." Editing it does not bring it back |
| ☐ R13 | The seller's `/seller/reviews` and her order screen | Each review names its product; her order screen shows the buyer's ratings |

---

## 19. Suite S — Reporting, complaints and blocking a buyer

Profiles A, B and C. Reports and complaints are not seeded; create them here.

### 19.1 Reporting

| ID | What to do | What must happen |
|---|---|---|
| ☐ S1 | As a buyer, "तक्रार नोंदवा" at the foot of a product page | "याची तक्रार नोंदवायची?" and "प्रशासक हे तपासतील. विक्रेतीला तुमचे नाव कळणार नाही." with six reasons (unsafe to eat, wrong information, not her own photo, offensive, a scam, other) |
| ☐ S2 | Pick "other" and type 3 characters | Cannot send — typed words need 5 to 200 characters. Only "other" asks for words |
| ☐ S3 | Send a real reason | "तक्रार नोंदवली. प्रशासक तपासतील." The listing **stays LIVE** — a report changes nothing on its own |
| ☐ S3a | Report the same product again | Answered as if it were the first (`duplicate: true`); no second row in the console |
| ☐ S4 | Report a review from the product page (buyer) and from `/seller/reviews` (seller) | Both accepted, with the review's own four reasons |
| ☐ S5 | As a buyer, "या दुकानाची तक्रार करा" on a seller card | The shop's list, including "पैसे घेतले, पण वस्तू पाठवली नाही" |
| ☐ S6 | As a seller, "या ग्राहकाची तक्रार करा" on one of her orders | The buyer's list (did not take delivery, false payment claim, abusive, scam, other); the report keeps the order id |
| ☐ S7 | Via curl: a seller reporting a product; a seller reporting a buyer who never ordered from her | 403, and 404 |
| ☐ S8 | Console → Products → "Reported" tab | The product with "{n} buyers reported this product" and each reason. "Close reports" keeps the listing LIVE and marks the reports reviewed, with who looked; "Take down" deletes it and its reports. (Known bug, 2026-09-28: the tab's count includes open reports of every kind, not only products) |
| ☐ S9 | Console → Reviews → "Reported (N)" | The reported review, with "Close reports" beside Hide |
| ☐ S10 | Console → Sellers → filter "Reported (N)", open her page | The shop reports with their reasons, "Closing the reports changes nothing about the shop. To stop her selling, use Block above.", and "Close reports" |
| ☐ S11 | Console → Complaints → "Reported buyers (N)" card | The buyer with her number, the report count, each reason with its order id, and Call / "Close reports" / "Block this number" |

### 19.2 Blocking a buyer

| ID | What to do | What must happen |
|---|---|---|
| ☐ S12 | Console → Complaints → "Block by number": type a buyer's number and no reason | Refused: "Write why this buyer is being blocked". A short number: "Type the 10-digit number" |
| ☐ S12a | Give a reason and confirm | Every session of hers ends at once. Signing in again: B13a. A session minted before the block that places an order gets 403 with "हा नंबर बाजारात बंद केला आहे. मदतीसाठी बाजाराच्या कार्यालयाशी संपर्क करा." |
| ☐ S12b | Block a number that has never signed in | Accepted — the customer row is created with the block, so it holds from the first sign-in |
| ☐ S12c | The same number on the **seller** door | Not blocked — the block is a buyer's |
| ☐ S12d | Close that buyer's account (T12), then sign in with the number | Still blocked — closing does not lift a block |
| ☐ S12e | Unblock | From the reported-buyers card's "Unblock", or `npm run admin -- unblock-customer <phone>`. (Known gap, 2026-09-28: a number blocked by typing, with no reports, has no unblock button in the console) |

### 19.3 The complaints desk

| ID | What to do | What must happen |
|---|---|---|
| ☐ S13 | As a seller, Help → "तक्रार नोंदवा"; as a buyer, Profile → the "आमच्याशी बोला" card → "तक्रार नोंदवा" | The sheet: "काय अडचण आहे ते लिहा. प्रशासक तुमचे खाते पाहून उत्तर देतील.", five subjects ("पैसे किंवा भरणा", "ऑर्डरबद्दल", "उत्पादनाबद्दल", "माझे खाते", "इतर काही"), a message box, "तक्रार पाठवा" and "लगेच हवे असेल तर व्हॉट्सॲप करा" |
| ☐ S14 | Send with no subject, or a message under 10 characters | Refused: "कशाबद्दल आहे ते निवडा" / "काय झाले ते थोडक्यात लिहा". Over 500 characters is refused too |
| ☐ S15 | Send a real one | "तक्रार नोंदवली. प्रशासक बघतील." |
| ☐ S16 | Console → Complaints, "Open" tab | Newest first: the subject, name, "Seller" with her SMB id or "Buyer", the time and the message; "Call +91 …", and for a seller "Open her account". (Known bug, 2026-09-28: the subject pill prints its raw key — see L23) |
| ☐ S17 | "Mark done" | "Complaint marked done"; it moves to "Done" with "Done by {who}" |

---

## 20. Suite T — Deleting an account

Profiles A, B and C. `UNDO_DAYS` is 7. An order counts as open unless it is DELIVERED,
REJECTED or CANCELLED — a PLACED order is open.

### 20.1 A seller closes her own account

| ID | What to do | What must happen |
|---|---|---|
| ☐ T1 | `/seller/profile`, scroll to the very bottom | Below Log out, a separate card "खाते बंद करणे" with a quiet "माझे खाते कायमचे बंद करा" — not a red button, not beside Log out |
| ☐ T2 | Tap it | Step 1 "खाते बंद करायचे का?": her shop leaves the catalogue, "तुमची {n} उत्पादने आणि तुमच्या दुकानाची माहिती काढली जाईल. भरलेले ₹50 परत मिळत नाहीत." with **her own** listing count; "नको, खाते ठेवा" / "हो, पुढे जा" |
| ☐ T3 | Step 2 | "खाते का बंद करत आहात?" with six reasons; "दुसरे कारण" needs 5–200 typed characters before "पुढे" wakes |
| ☐ T4 | Step 3, "शेवटची खात्री" | "शेवटचे 4 अंक" of **her own** number, typed. "खाते बंद करा" stays disabled until they match. Via curl, wrong digits: 400 "हे अंक तुमच्या नंबरशी जुळत नाहीत" |
| ☐ T5 | Try it with a PLACED or ACCEPTED order of hers | **409**; the sheet names the orders under "आधी ही ऑर्डर पूर्ण करा किंवा रद्द करा" instead of printing an error. Nothing is closed |
| ☐ T6 | With no open orders, close | "खाते बंद झाले", seven days until erasure, "समजले" signs her out. A second device of hers gets 401 on its next call |
| ☐ T7 | As a buyer | Her shop and products are gone from the catalogue; `GET /api/sellers/<id>` is 404; ordering from her is refused. No product was touched and `isOpen` is unchanged |
| ☐ T8 | Sign in again with her number within the week | At the top of My Business: "तुमचे खाते बंद होत आहे", "{days} दिवसांनी तुमची सर्व माहिती कायमची पुसली जाईल. …" and "खाते परत सुरू करा" |
| ☐ T9 | Tap it | "खाते पुन्हा सुरू झाले"; status ACTIVE, and the shop is back **exactly** as it was if her term is still running. Via curl, restoring an account that is not closing: 409 "हे खाते बंद होत नाही आहे." |
| ☐ T10 | Close again; stop the API, set `closingAt` in the past in `db.json`, start it | The boot log erases it (`[account] erased 1 closed account(s)`); the sweep also runs every 15 minutes. Her row keeps its id, `status: CLOSED`, the `womenBizId` and the money; name, phone, photo, village, UPI and readiness answers are empty; her listings are `ARCHIVED` tombstones with name, photo and ingredients emptied; her payment screenshots and phone are gone; her complaints and reports about her shop lose her name |
| ☐ T11 | Register a new seller with that same phone | Allowed — closing is not a ban |

### 20.2 A buyer closes her account

| ID | What to do | What must happen |
|---|---|---|
| ☐ T12 | `/shop/profile`, the same bottom card | The same steps, worded for her: "तुमचे नाव, फोन नंबर आणि साठवलेले पत्ते काढले जातील. झालेल्या ऑर्डरची नोंद विक्रेतीकडे राहील." Open orders refuse it the same way. (Known gap, 2026-09-28: the reason she picks is never sent to the server) |
| ☐ T13 | Close | Immediate — **no** seven-day window. "तुमचे नाव, फोन नंबर आणि पत्ते काढले आहेत. …" and she is signed out |
| ☐ T14 | Look at the seller's copy of her past orders | The buyer reads "ग्राहक"; phone, address and landmark are empty; the pincode stays. Her reviews keep their stars and words, under "ग्राहक" |
| ☐ T15 | Search the stopped API's `db.json` for her 10-digit number | It appears **nowhere** — not in orders, reviews, reports, complaints or sessions (they are re-keyed to a `c-closed-…` id) — unless she was blocked, in which case only the blocked row keeps it |
| ☐ T16 | Sign in again with the number | A new, empty buyer: the name screen with the consent tick, no orders, no addresses |

### 20.3 Staff close an account for someone who cannot sign in

| ID | What to do | What must happen |
|---|---|---|
| ☐ T17 | Seller's page in the console → "Close account on her request" | A dialog: how the request came (phone / WhatsApp / email), a tick "I rang the registered number back and confirmed the account is hers", her **last 4 digits**, an optional note. Incomplete: "Choose how the request came in, tick the call-back, and fill in the digits needed." |
| ☐ T18 | Via curl, omit the channel; then the tick; then give wrong digits | 400 each time: "विनंती कशी आली ते निवडा", "आधी नोंदणी केलेल्या नंबरवर फोन करून खात्री करा", "शेवटचे 4 अंक या खात्याच्या नंबरशी जुळत नाहीत" |
| ☐ T19 | Close her properly | The same effect as her own button — shop gone, sessions revoked, seven days. Her page: "Account closing. Her details will be erased on {when}." with the channel and the staff member's name |
| ☐ T20 | "Reopen account" within the week | Restored, exactly as in T9 |
| ☐ T21 | Complaints screen → "Close a buyer's account" by number | Same checks (no digits for a buyer); open orders refuse it with the list; success says how many orders were cleared. Immediate, like T13 |
| ☐ T22 | `npm run admin -- close-seller <phone> --via phone --called-back` | Drives the same route and says the details are erased in 7 days |
| ☐ T23 | Block a seller who is inside her closing week | Record what happens. (Known gap, 2026-09-28: blocking replaces CLOSED with BLOCKED, and the erasure sweep then never runs for her) |

### 20.4 The public deletion page

| ID | What to do | What must happen |
|---|---|---|
| ☐ T24 | Signed out, open `/delete-account` (also from the landing footer) | Loads with no session and no tabs: the app and college names, a language picker, the four in-app steps with a "लॉगिन करा" button, what is erased, "काय राहते आणि का" (orders, the ₹50 records, reviews and complaints, a blocked number, backups within 12 months), the seller's 7-day window, and a Privacy Policy link |
| ☐ T25 | "ॲप नसेल तर" | "फोन करा" opens the dialler at +91 9420488874, "व्हॉट्सॲपवर मदत" opens WhatsApp, "ईमेल करा" opens mail with the subject "खाते बंद करण्याची विनंती / Account deletion request". Check the printed address is the college's real one — the code has `principal.jascca@gmail.com`, a commit message spells it `jassca` |
| ☐ T26 | The same page inside the APK (16.1) | "काय राहते आणि का" does not name the ₹50 |

---

## 21. Suite U — Policies and consent

`POLICY_VERSION` is `2026-09-27` (`shared/src/legal.ts`).

| ID | What to do | What must happen |
|---|---|---|
| ☐ U1 | Signed out, open `/legal` | "धोरणे आणि अटी", "27 सप्टेंबर 2026 पासून लागू" in Latin digits, a language picker and five documents: गोपनीयता धोरण, वापराच्या अटी, विक्रेती करार, परतावा धोरण, तक्रार निवारण आणि संपर्क |
| ☐ U2 | Open each; switch to English | Each has the same sections in both languages and ends with "इतर धोरणे". `/legal/xyz` goes to `/legal` |
| ☐ U3 | Read the numbers in the text | ₹50, the two edits, the 7 days, the 30-day review window and the 7-day reminder match what the app enforces (they are imported from the rules) |
| ☐ U4 | The grievance document | Names the operator and the grievance officer; the officer's phone equals the support number, 9420488874 |
| ☐ U5 | Both profile screens | A "धोरणे आणि अटी" tile, "गोपनीयता, अटी, परतावा आणि तक्रार" |
| ☐ U6 | Sign in as a seed seller (no `acceptedPolicies`) | The full-screen "बाजाराचे नियम" over the whole app, tabs included, with no close: the first-time text, the reading links, and one button "मान्य आहे, आणि माझे वय 18 किंवा त्याहून जास्त आहे" |
| ☐ U7 | Open a reading link, press Back | The gate is still there |
| ☐ U8 | Agree | The gate lifts; `acceptedPolicies` is `{ version: "2026-09-27", at }`. It does not come back on reload or re-login |
| ☐ U9 | Stop the API, set her `acceptedPolicies.version` to an older date, restart, sign in | The gate returns with "आमच्या धोरणांत बदल झाला आहे. पुढे जाण्याआधी नवी धोरणे वाचा आणि मान्य करा." |
| ☐ U10 | Make the gate's check fail (stop the API) and open the layout | She is let through — nobody is locked out of her own shop over a network blip — and asked again on the next open |
| ☐ U11 | Via curl, `POST /api/policies/accept` without a literal `acceptPolicies: true`; and with an admin token | 400; and 403 |
| ☐ U12 | Consent at registration | Covered by C12b / C21a (seller) and B14a–B16 (buyer) |

---

## 22. Suite V — The Play reviewers' demo account

`9999999999` is both a seller and a buyer, set up in MSG91's widget so no SMS is sent.
Register it once as a seller with a live listing and as a buyer.

| ID | What to do | What must happen |
|---|---|---|
| ☐ V1 | As an ordinary buyer, browse the catalogue, search, and open the demo shop's product id and `GET /api/sellers/<demo id>` directly | The demo shop is **absent** — not in the list, and 404 by id, for reviews and for the contact route |
| ☐ V2 | As the demo buyer | The demo shop **is** visible |
| ☐ V3 | Via curl, a real buyer orders from the demo shop | 409 "हे डेमो दुकान आहे. इथून ऑर्डर देता येत नाही." |
| ☐ V4 | The demo buyer orders from a real shop | 409 "डेमो खात्यातून फक्त डेमो दुकानातूनच ऑर्डर देता येते." |
| ☐ V5 | The demo buyer orders from the demo shop, and the demo seller walks it to DELIVERED | Works end to end, and never touches a real seller or buyer |
| ☐ V6 | Request four codes for `9999999999` in a day | No 429 (B11a) |

---

## 23. Cross-cutting regression matrix

Re-run this short list after **any** change to auth, the store, or `shared/`.

- [ ] Log in as a seller, hard-refresh, still signed in
- [ ] Log in as a customer, press Back to `/`, still signed in
- [ ] Place a COD order end to end through DELIVERED; the buyer's rating gate appears and lifts once every product is rated
- [ ] Place a UPI order; the buyer pays only after acceptance, and the seller confirms the payment separately before packing
- [ ] Cancel a PLACED order as the buyer; the seller sees who stopped it and why
- [ ] Send in a product; it lands PENDING, and appears in the customer catalogue only after an admin publishes it
- [ ] Fill every slot; the 6th is refused by the **server** (402)
- [ ] Admin approves a payment with all three checks ticked; the seller goes ACTIVE with a six-month term
- [ ] Admin rejects a product with a reason; it is deleted at once, her slot frees, and she reads the reason in her updates list
- [ ] A cart holding one shop refuses a second shop's product, naming the first
- [ ] A signed-in person whose `acceptedPolicies` is out of date meets the PolicyGate once, and not again after agreeing
- [ ] A seller closes her account and reopens it within the week; a buyer closes hers and her number is gone from `db.json`
- [ ] Back from a product returns to the same place in a long list
- [ ] Switch to English; no Devanagari placeholders anywhere
- [ ] `npm test` and `npm run typecheck` still green

---

## 24. Bug report template

```
ID:            (the test ID, e.g. H12)
Surface:       seller app / customer app / admin console / API
Build:         git rev-parse --short HEAD
Environment:   .env shape (Cloudinary on/off, Firestore on/off, OTP mode from the boot banner)
Account:       phone / SMB id / admin email
Steps:         1.
               2.
               3.
Expected:      (quote the "What must happen" column)
Actual:        (what you saw; screenshot)
API response:  (status plus the {error, messageMr, fields} body, from devtools Network)
Console:       (any JS error)
Severity:      blocker / major / minor / cosmetic
Reproducible:  always / sometimes / once
```

---

## 25. Documentation that is out of date

Checked on 2026-09-28. Where `CLAUDE.md` and the code disagree, test the **code**, not
the doc:

1. **Where a UPI order waits.** `CLAUDE.md` (*Order state machine*) says a UPI order
   "stops at `PACKED`" until the seller confirms the money; the code refuses the move
   **to** PACKED, so it waits at ACCEPTED (I11a).
2. **Buttons are 54px, not 56.** `CLAUDE.md` (*Design rules*) says 56px buttons;
   `--btn-h` in `frontend/src/styles/theme.css` is 54px. A13 and M8 test the token and
   ask which is intended.
3. **The seller's bank QR does not reach the buyer.** `CLAUDE.md` (*Product photos*)
   says "the QR reaches every buyer at checkout"; checkout shows no QR, and the order
   screen draws one from her UPI ID with the amount (K6). `upiQrUrl` is left out of the
   seller object on `GET /orders/:id`.
4. **Re-posting a UTR on the same order is not possible.** `CLAUDE.md` (*The two numbers
   nobody can check for her*) says it is left alone as a correction; after the first
   `POST /orders/:id/pay` the order is `UPI_SUBMITTED` and any second post is 409 (I11e).
5. **`PincodeBar` is not rendered.** `CLAUDE.md` (*Where an order may go*) says the
   checkout and `PincodeBar` warn; only checkout does — no screen draws the bar (G6).
6. **`ProductDetail` is not the only screen that adds to a cart.** `CLAUDE.md` (*One
   seller per cart*) says it is; the grid cards' Add control adds too, and refuses a
   second shop with a toast (H5a).
7. **The boot banner, not `CLAUDE.md`,** still says "Images off - emoji only", and still
   says `Database Firestore` after a failed connection has fallen back to the JSON file
   (O1, O4).

This plan used to list two more, and both were the plan's error, not `CLAUDE.md`'s: a
submitted listing **does** go to a moderation queue (`PENDING`, Suites E, F and L), and
`CANCELLED` **is** reachable (I17). The state machine is five states, ending at
`DELIVERED`, in both.
