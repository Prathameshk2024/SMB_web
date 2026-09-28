# Training session checklist

For trainers and co-trainers running a 2–3 hour session on the app for rural
women sellers, with students and teachers helping. Checked against the code on
`prathamesh2` on 28 September 2026.

Marathi in quotation marks below is the app's own wording, copied from its
screens. Use those exact words in the room.

---

## ⚠️ Fix this before the session: the app's safety limits will block a training room

The server limits how many logins and sign-ups can come from one internet
connection. If everyone in the room is on the same venue Wi-Fi or one phone's
hotspot, the whole room counts as one user (`backend/src/auth/rateLimit.ts`):

| Limit | Value | What happens in the room |
|---|---|---|
| OTP requests from one connection | **20 per hour** | The 21st woman can't get a code for an hour |
| Seller sign-ups from one connection | **10 per hour** | Only 10 women can register per hour |
| OTP codes per phone number | **3 per 24 hours** | Pressing "resend" 3 times locks her out until tomorrow |
| Code checks from one connection | 50 per hour | Typos by the whole room add up |
| Everything the app asks the server, from one connection | 300 per minute | A whole room browsing at once can be refused for up to a minute ("खूप विनंत्या आल्या…") |

- [ ] **Best option:** each woman uses her own mobile data, not venue Wi-Fi or a shared hotspot.
- [ ] **Or** raise these limits for the day, deploy **the night before**, and put them back afterwards. The counts are kept in memory, so a new deploy also resets them.
- [ ] **Never deploy during the session.** The server must run as a single copy, and for a few seconds during a deploy there are two.
- [ ] Tell everyone: **type the code once, and don't press "resend" again and again.** 3 codes a day is the limit.
- [ ] The code arrives by SMS on the phone that has that SIM. The SIM must be in the phone she is holding, not at home.

---

## A. The day before

**Accounts and data**
- [ ] Make sure the admin console login works. Have **two admins** available: one presents, one approves listings and records payments live.
- [ ] Set up **one demo seller shop** (a trainer's number) with 3–4 approved products and a real UPI ID. All practice orders go to this shop.
- [ ] Decide on practice orders: **women must not place test orders with real sellers.** Any order placed reaches the real seller.
- [ ] Decide what happens to practice listings. Every new product goes to admin for checking. Approve the real ones; **reject** the practice ones. Rejecting **deletes** the listing and gives the slot back.
- [ ] Decide on the ₹50 pack: will women actually pay on the day? **The Android app shows no price and no way to pay** (a Google Play rule), so the money is taken at the desk: cash, or UPI to the college account. The admin then opens her page in the admin console and presses **Record payment**. That switches her shop on at once, so the admin must see the cash in hand or the money in the college account first.
- [ ] If women will pay by UPI at the desk, print the college UPI ID and payee name on the poster, and have the college account's UPI app or bank statement open. The UTR is required when recording a UPI payment.
- [ ] Don't use the Play Store reviewers' demo number for anything. Its shop is hidden from everyone else and it cannot order from real shops.

**Materials**
- [ ] Projector, or a phone mirrored to the screen / TV (screen-mirroring app plus cable)
- [ ] Printed **APK install steps** or a QR code for the link, and the APK file on a pendrive/Bluetooth for phones with no data. It must be **the latest APK**: an older one gets no phone notifications.
- [ ] A printed list of each woman's name, phone number and village
- [ ] Printed **one-page Marathi cards**: login, adding a product, accepting an order, confirming a payment. Mostly pictures and few words.
- [ ] Sample products to photograph: a pickle jar, papad, a bag. Take a good photo beforehand to show as an example.
- [ ] Power banks, extension boards and charging cables (Type-C and micro-USB)
- [ ] An attendance / consent sheet, with separate consent for taking photos of the women

**Practice run**
- [ ] Do the whole flow once on a cheap Android phone **inside the APK**: login → register → desk payment recorded → product → order → accept → payment → deliver → review.
- [ ] Allow notifications when the app asks, then check that a phone notification arrives when a practice order is placed. Try it on a Xiaomi, Oppo, Vivo or Realme phone if you can: those phones often stop notifications to save battery.
- [ ] Time it. This tells you how long each part will really take in the room.

---

## B. On the day, before starting (arrive 45 minutes early)

- [ ] Check the network in the hall: 4G signal for each carrier (Jio, Airtel, Vi)
- [ ] Open the app once. The first load may be slow because the server was idle.
- [ ] Admin console open on a laptop: **Products → To review**, and **Sellers** (to open a woman's page and press **Record payment**)
- [ ] Seat women **in pairs or groups of 3–4** (someone who can read beside someone who can't), with one student/teacher volunteer per group
- [ ] Brief the volunteers for 10 minutes: **don't take the phone and do it for her; point with your finger and let her press.** Never ask to see her OTP.
- [ ] Check phones: Android, enough free storage, APK installed or ready to install

---

## C. Session plan (about 2 hours 45 minutes)

| Time | Part | Content |
|---|---|---|
| 0:00–0:15 | **Introduction** | Why the market is named after शांताबाई काकी, who can sell, what is sold. Photos of real sellers. |
| 0:15–0:30 | **Installing the app** | Install the APK and allow "unknown apps". Allow notifications when asked. Introduce the language (Marathi by default). |
| 0:30–0:55 | **Login + seller registration** | In small groups (because of the limits above) |
| 0:55–1:05 | Tea break | Pending registrations get finished; desk takes ₹50 and the admin records it |
| 1:05–1:40 | **Adding a product** | Photo, name, price and size, stock, "send for checking" |
| 1:40–2:15 | **Orders and money** | Trainers place live orders; each woman accepts, packs and delivers |
| 2:15–2:30 | **The buyer's side** | Students/teachers as buyers |
| 2:30–2:45 | **Help, safety, questions, closing** | Help tab, complaints, printed cards, help number |

---

## D. What to cover in each part

### 1. Introduction
- [ ] "What will the app do for you?" A shop on your phone that buyers from other villages can see.
- [ ] **Costs:** registration is free. **₹50 = 5 products for 6 months.** No commission on sales. The ₹50 is paid **at the desk or to the coordinator**, never inside the app: the app shows no price.
- [ ] **Money comes straight from the buyer to your UPI.** The app does not hold your money.
- [ ] No English is needed. The whole app is in Marathi, and you can **speak into the mic** to type.
- [ ] **Only women aged 18 or older can register.** The last registration screen asks her to confirm it.

### 2. Login
- [ ] Enter your 10-digit mobile number → a 6-digit code comes by SMS → type it in.
- [ ] **Never tell this code to anyone**, even someone who calls saying "I'm from Shantai Bazar".
- [ ] You don't need to log in every time. If you don't open the app for 15 days, you'll be asked again (and once every 3 months in any case).
- [ ] "Back" or refresh doesn't log you out. Only the **Log out** button does.
- [ ] A woman who registered **before 27 September 2026** sees a full screen, "बाजाराचे नियम" (the market's rules), once after logging in. The links open the policies; the button is "मान्य आहे, आणि माझे वय 18 किंवा त्याहून जास्त आहे". Read it with her; there is no other way past it.

### 3. Seller registration (6 screens)
1. [ ] **About you**: name, age, education
2. [ ] **Village and address**: pick the village from the list; pincode
3. [ ] **Your business**: shop name, type of business, **do you sell food?** Explain carefully: **this answer is hard to change later**, and it decides which product categories she sees.
   - A food seller also sees "FSSAI क्रमांक". If she has a food licence, type the 14-digit number from it. If she has none, leave it blank; she can still register. Buyers see this number on her food products, so check it digit by digit. She can add, correct or remove it later from Edit profile.
4. [ ] **Digital use**: tell them there's no right or wrong answer. It is for measuring before and after.
5. [ ] **Where your money arrives**: UPI ID. ⚠️ **The most important screen.**
   - Have her open PhonePe or GPay and **read the UPI ID from there**. Don't type it from memory.
   - A wrong UPI ID means buyers' money goes to a stranger.
   - If the app says "Did you mean @ybl?", read it and correct it.
   - A photo of her bank's payment QR can be added here too, or later from her profile.
6. [ ] **Check**: read every answer. "बदला" (Change) takes you back to that screen.
   - At the bottom: the policy links, then one box to tick: "मी वरील करार, अटी आणि धोरणे वाचली आहेत, मला ती मान्य आहेत, आणि माझे वय 18 किंवा त्याहून जास्त आहे". "नोंदणी पूर्ण करा" (Complete registration) stays grey until it is ticked. Explain what she is agreeing to in plain words; don't tick it for her.
- [ ] Explain the **SMB ID** (e.g. SMB-ANADUR-01), including what the village and number mean.
- [ ] Show that the first time a screen opens it explains itself (the walkthrough), and that **Help & Training** replays it any time.

### 4. The ₹50 pack
- [ ] Why it's needed: without a pack, nothing can go live.
- [ ] **The app does not take the ₹50 and does not show a price.** After registering, the app says "कार्यालयाने तुमचे दुकान सुरू केल्यावर तुम्ही 5 उत्पादने टाकू शकाल." and the button is just "पुढे" (Next).
- [ ] She pays **at the desk or to the coordinator**: cash, or UPI to the college account on the poster. If by UPI, the desk needs the **12-digit UTR** from her success screen (show where it is in PhonePe/GPay: "UTR" or "UPI Ref No.").
- [ ] Until it is recorded, her home screen (माझा व्यवसाय) says "प्रशासकाच्या मंजुरीची वाट पहा", and its "माझी नोंदणी" (My registration) button opens a screen saying "तुमचे दुकान अजून सुरू झालेले नाही". That is normal: tell her to come to the desk, not to register again.
- [ ] The admin records it on the laptop, and her shop switches on at once. Her home screen then says "आणखी 5 उत्पादने टाकू शकता" and, under it, until what date the shop is open ("वर्गणी … पर्यंत सुरू आहे").
- [ ] **Six months later:** a reminder comes a week ahead. If the date passes, the shop is paused: buyers can't see her products, but nothing is deleted. Pay ₹50 at the desk again and **everything comes back exactly as before**, products included. Paying in the reminder week loses no days.
- [ ] (Only if someone asks: on the website in a browser there is still a screen to pay the ₹50 herself. In the session, use the desk.)

### 5. Adding a product
- [ ] **Photo:** only one photo, from the gallery. Show a good photo and a bad one: light, plain background, whole product visible, not blurry. Take it with the phone camera first, then choose it in the app.
- [ ] Name (use the **mic** if typing is hard), then **is it food?**, then the category. If the product isn't in the list, choose **"Other"**. Don't put it in the wrong category.
- [ ] For food: ingredients and **veg/non-veg**. Anything else: material.
- [ ] **Price, MRP, unit, and the size.** "एका नगात किती?" means what the price is for: 500 g, 1 litre. If the unit is "सेट", it also asks "एका सेटमध्ये किती नग?" (a set of 6 ladoos: write 6). Buyers compare shops by this, so get it right.
- [ ] **Stock.** Made to order? Explain what that means.
- [ ] The button says "तपासणीसाठी पाठवा" (send for checking), not "publish". The product appears to buyers only **after admin checks it**. Show one approval live in the room.
  - [ ] ⚠️ The green box on that last screen still says "लगेच प्रकाशित होईल" (goes live straight away). **That line is wrong**; the line just above the button is right. Tell the room before they read it.
- [ ] If it's rejected, **the product is removed** and its place is freed. The reason arrives in her updates (the bell). Fix the problem and add it again.
- [ ] ⚠️ **Rules:**
  - [ ] **You can't delete a product that has been sent.** If you want it removed, ask the admin.
  - [ ] **Name, photo, category, size and so on can be changed only 2 times.** Whether it is food can't be changed at all.
  - [ ] **Price and stock can be changed any number of times.** Keep them up to date.
  - [ ] A draft ("नंतर पूर्ण करते", finish later) costs no slot and can be deleted.

### 6. Orders, the most important part (do it live)
Trainers place orders from the buyer's side into the women's shops (or the demo shop):
- [ ] **A new order arrives** → a **notification on the phone**, even when the app is closed, and the bell / updates list inside the app. The phone also tells her when a buyer says they have paid, when a buyer cancels, and when the office approves or rejects something.
  - [ ] If she pressed "don't allow" when the app asked, a yellow bar says "फोनवर सूचना बंद आहेत". Press "सेटिंग उघडा" and turn notifications on.
  - [ ] On Xiaomi, Oppo, Vivo and Realme phones, also set the app's battery use to "No restrictions" and turn on Autostart (the मदत व प्रशिक्षण tab says the same).
  - [ ] Still tell them to **open the app twice a day**. A phone that is off, out of data, or with an old APK gets no notification.
- [ ] Look at the order: product, quantity, buyer's village. If it says "तुमच्या नोंदवलेल्या भागाबाहेर" (outside your area), decide whether you can get there.
- [ ] **Accept or Reject.** Rejecting needs a reason from the list.
- [ ] "ऑर्डर स्वीकारा" (Accept) first asks "किती वेळात पोहोचवाल?" (how soon can you deliver?). Tap आज / उद्या / 2 दिवसांत / 3 दिवसांत, or say it into the mic. The buyer sees exactly these words, so only promise what she can do. Not sure? "वेळ न सांगता स्वीकारा" accepts without a time.
- [ ] **UPI order:** after you accept, the buyer pays → you **check your own PhonePe/GPay to see if the money arrived** → only then press "होय, पैसे मिळाले" (yes, money received).
  - [ ] ⚠️ **A UTR typed by the buyer is not money.** Always check your own UPI app.
  - [ ] Until you confirm the money, the "तयार आहे" (ready) button doesn't appear. That is on purpose.
- [ ] "तयार आहे" (ready) → "पाठवले आहे" (sent out) → "पोहोचले" (delivered)
- [ ] **Delivery charge:** the app doesn't ask for it, so the buyer sees "ask the seller". **Call the buyer and tell them the charge.** The buyer's phone number is on the order.
- [ ] **Cancelling:** the seller can cancel between Accepted and Out for delivery. The button is at the bottom. **If money came in, you have to send it back yourself.** The app doesn't return money.
- [ ] A buyer can cancel only before you accept. After that they'll call you.
- [ ] **A buyer who causes trouble** (never took the delivery, said they paid when nothing came, was abusive on the phone): at the very bottom of that order, "या ग्राहकाची तक्रार करा" (report this buyer). The buyer is not told. The office looks at it; one report does not block anyone.

### 7. The buyer's side (students/teachers)
- [ ] Customer registration: phone, OTP, name, and the same tick box (agree + 18 or older)
- [ ] Browse by category, the product page (with its size, e.g. 500 g), "More from this shop"
- [ ] **A cart holds one shop's goods at a time.** Adding from another shop is refused; finish or empty the cart first.
- [ ] **Delivery charge:** if the seller has not set one, the cart says "विक्रेतीला विचारा" (ask the seller), never "free". The "डिलिव्हरीबद्दल विचारा" button shows the seller's number with Call and WhatsApp.
- [ ] Order → wait for the seller to accept → **then pay** (take a screenshot of the QR and scan it from the gallery in PhonePe/GPay, or copy the UPI ID; then the 12-digit UTR)
- [ ] The order screen shows 4 stages: confirmed → shipped → out for delivery → delivered, and the delivery time the seller gave
- [ ] **Rating is required after delivery.** "मिळालेल्या वस्तूंना तारे द्या" covers the whole app, and **every item on the order** needs stars; words are optional. Until they rate, the app won't let them do anything else or place a new order. Tell them in advance so it doesn't come as a surprise.
- [ ] Only the buyer's first name is shown publicly.
- [ ] A product, a review or a shop that looks wrong (unsafe food, someone else's photo, fraud) can be reported with the quiet "तक्रार नोंदवा" link under it, or "या दुकानाची तक्रार करा" on the seller card. The seller is not told who reported.

### 8. Reviews and the business screen
- [ ] The seller's rating is the average of her products' ratings
- [ ] Where to see reviews, "My business", "My buyers"
- [ ] Good packing, on-time delivery and honest photos lead to good ratings
- [ ] A review that is abusive or has a phone number in it: "तक्रार नोंदवा" under that review, on her own reviews screen. The office can hide it; nobody can edit a buyer's words.

### 9. Help, complaints and deleting an account
- [ ] The "मदत व प्रशिक्षण" tab (Help & Training): replay the walkthrough of any screen; "व्हॉट्सॲपवर मदत" and "फोन करा" reach the college office; "तक्रार नोंदवा" sends a written complaint (pick what it is about, write what happened) that the office answers.
- [ ] Buyers have the same Help card at the bottom of their profile.
- [ ] **Deleting the account** is at the very bottom of "माझी माहिती" (My Profile): "माझे खाते कायमचे बंद करा". Show where it is, and say clearly: **this is not Log out.**
  - [ ] It asks three times: what she loses (her products, and the ₹50 is not returned), why she is leaving, and then the last 4 digits of her own phone number.
  - [ ] It refuses while any order is still in progress. Finish or cancel those first.
  - [ ] The shop disappears at once, but **for 7 days she can change her mind**: log in with the same number and press "खाते परत सुरू करा". After 7 days her details are erased for good.
  - [ ] If her phone is lost or the code never comes, she calls the office. Staff call her registered number back before closing anything.

### 10. Safety and fraud (don't skip this)
- [ ] Never tell the OTP to anyone
- [ ] A fake "payment done" screenshot or SMS is not money. **Only trust your own UPI app.**
- [ ] Don't tell anyone your UPI PIN, and there is no PIN for *receiving* money. "Enter your PIN to receive" is a scam.
- [ ] Don't put your phone number in a product description
- [ ] On a shared phone, **log out** after use
- [ ] Anyone calling "from Shantai Bazar" asking for money to switch a shop on: pay only at the desk or to the coordinator you know

---

## E. Suiting the audience

- [ ] **Speak Marathi.** Use the app's own words: ऑर्डर, भरणा, स्वीकारा. Avoid English terms (not "submit" or "dashboard").
- [ ] **Show one step → they do it → check → next step.** Go at the pace of the slowest woman.
- [ ] Point at the icons and colours: green tick = done, red = cancelled. Every status has a word written with it.
- [ ] Don't take the phone away from her. **Her finger should do the pressing.**
- [ ] Don't praise or criticise anyone's reading in front of the group.
- [ ] Give an example of a local product and a real price ("mango pickle, 500g, ₹150").
- [ ] Take photos only with consent, and don't photograph women who refuse.
- [ ] Choose a time that works around household work. Keep a break and water.
- [ ] Take questions again after every part: "Did anyone get stuck here?"

---

## F. Closing (last 15 minutes)

- [ ] Hand out the printed cards, the help number (the college office, **9420488874**, the same number the Help tab's buttons ring) and the name of the local coordinator
- [ ] Tell the next steps: pay ₹50 at the desk → add products → wait for approval
- [ ] Keep a list of anyone who didn't finish registering (OTP limit, network) and **follow up the next day**
- [ ] Two-minute verbal feedback: what was easy, what was hard

## G. After the session

- [ ] Admin: approve or reject all pending products, and record every ₹50 taken at the desk, **the same day**. A long wait is discouraging.
- [ ] Cancel practice orders and reject practice products (rejecting deletes them and frees the place)
- [ ] Look at the admin **Complaints** screen for anything raised during the session, and mark it done
- [ ] If you raised the limits, put them back and deploy
- [ ] Write down what caused trouble (which screen, which word) so the app can be fixed
- [ ] Call each woman after a week and ask whether her first order has come

---

**Take along:** a list of what the app doesn't do yet, so you can answer
honestly when asked. There is no chat, no returns or refunds inside the app,
no way to reply to a review, and no direct camera photo (the photo must come
from the gallery). The app never moves money: refunds are sent back by the
seller herself.
