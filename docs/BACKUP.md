# Backups — and how to restore from them

The live project is on Firebase's free **Spark** plan, which has no managed
backups and no point-in-time recovery — only the one hour of version history
that recovered six sellers on 10 September 2026. So the backup is a copy into
**separate free accounts**, made by `npm run backup` and put back by
`npm run restore` (`backend/scripts/backup.ts` and `restore.ts`; the rules in
`backend/src/db/backupPlan.ts`, the reading and writing they share in
`backupIo.ts`, tests in `backend/tests/backup.test.ts`).

```
                      nightly, GitHub Actions
   live Firestore  ─────────────────────────────►  backup Firestore
                                                   + snapshots/ (dated copies)
   live Cloudinary ─────────────────────────────►  backup Cloudinary

                      only when asked (--local), a laptop
   live Firestore  ─────────────────────────────►  firestore-<date>.json.gz
   live Cloudinary ─────────────────────────────►  images/
```

The app only ever uses the live accounts. Nothing reads a backup until
somebody restores from one.

---

## 1. What is where

| Copy | Account | Updated | Holds |
|---|---|---|---|
| Backup Firestore **A** | `smb-backup-99778` | nightly, 03:00 IST | the latest copy, in the same collections as live |
| Backup Firestore **A**, `snapshots` | `smb-backup-99778` | nightly, 03:00 IST | one dated copy per night: the last 30 days, then the first of each month until a week before it turns 12 months old |
| Backup Cloudinary **A** | `e4bdb893` | nightly, 03:00 IST | the photos the live account has; one it has destroyed goes on the next run |
| Local database files and photos | `backend/data/backups/` on a laptop | only with `--local` | the same rules, applied only when `--local` runs again on that laptop |

**How long deleted data survives in a backup, in one sentence for the privacy
policy:** a person's data is gone from the nightly mirror and the backup
photos on the night after it is deleted live, and from the dated copies
within 12 months (`BACKUP_KEEP_DAYS` and `BACKUP_KEEP_MONTHS` are the two
numbers; the months can be shortened, never lengthened).

**Nobody has to do anything to keep that promise**, with one exception:
the Backup workflow has to stay enabled, because it is also what prunes.
GitHub disables a scheduled workflow in a public repository after 60 days
without a commit, and emails a warning first — re-enable it from the Actions
tab. A monthly copy goes a week before its anniversary rather than on it, so
a late or skipped night never carries one past twelve months.

The dated copies used to be files on a laptop, pruned only when somebody ran
the backup there — so the promise held only as long as somebody remembered.
A `--local` copy still works that way, which is why it is off by default:
**make one for a restore drill or before risky work, and delete it
afterwards.** It is the only copy that survives losing every account, which
is worth having in hand on the day it is needed and not worth keeping for a
year nobody is watching.

Each stored copy is one document of gzipped JSON — about 42 KB today — split
into parts once it outgrows Firestore's 1 MiB document limit. The mirror and
a restore only touch the collections the app uses, so neither ever reads,
copies or empties `snapshots`, and the app never loads it.

Backup A was set up on 24 September 2026. **The logins for the backup
accounts must be known to more than one person** — a backup nobody can sign in
to is not a backup.

What is copied: `sellers`, `products`, `orders`, `payments`, `customers`,
`reviews`, `admins`, `authEvents`, and every image under
`shanta-mahila-bazar/` (`product/` and `payment/`).

What is **not**:

- `sessions` — live credentials. Copying them widens who could steal one;
  losing them means everybody signs in again.
- Configuration: Secret Manager, Cloud Run settings, Vercel variables, MSG91.
  `docs/DEPLOY.md` is the record of those.
- The Android wrapper and its signing keystore, which live outside this repo.

---

## 2. The rules the copy follows

- **The live project is only read.** One run costs one read per document —
  about 950 today, the same as one API start — out of Spark's 50,000 a day.
- **The backup database mirrors the live one**, deletions included, writing
  only documents that changed. A copy that never deleted would bring back every
  purged demo seller and deleted draft on the day it was restored.
- **A live project that has shrunk is not copied.** If any collection has lost
  more than half its documents since the backup was taken, or the live read
  comes back empty, nothing is written, the backup keeps the older data, and
  the run fails. This is the same line `isBulkDelete()` draws in the API. The
  override is `ALLOW_BULK_DELETE=true`, for a shrink that is deliberate.
- **Photos follow the live account, deletions included.** They used to be
  kept for ever, as the proof behind every approved ₹50 — but a seller who
  deletes her account has her screenshots and product photos destroyed live,
  and a backup that kept them was keeping what she had been told was gone.
  The same shrink check applies: if more than half a copy's photos would go,
  or the live account lists none, nothing is removed and the run fails.
- **The script refuses to use the live project or the live Cloudinary account
  as a backup target.**
- **With two or more targets, each run copies into one**, rotating by day, so
  the one not copied today still holds yesterday.
- **A run that did not finish exits with an error**, so a scheduled one shows
  red — including a target whose live half is not configured.

---

## 3. Running it

### Nightly — GitHub Actions

`.github/workflows/backup.yml` runs at 03:00 IST (`30 21 * * *` UTC). To run
it by hand: **Actions → Backup → Run workflow**. The checkbox *Report only,
write nothing* is the dry run — ticked, it only reports; unticked, it copies.

It uses these repository secrets (Settings → Secrets and variables → Actions):

| Secret | What |
|---|---|
| `LIVE_FIREBASE_SERVICE_ACCOUNT` | a key for the live project, the whole JSON |
| `LIVE_CLOUDINARY_CLOUD_NAME`, `LIVE_CLOUDINARY_API_KEY`, `LIVE_CLOUDINARY_API_SECRET` | the live Cloudinary account |
| `BACKUP_A_FIREBASE_SERVICE_ACCOUNT` | the backup project's key, the whole JSON |
| `BACKUP_A_CLOUDINARY_URL` | the backup account's `cloudinary://key:secret@cloud` |

It keeps nothing on the runner and uploads no artifact: the runner is wiped
after each run, downloading every photo each night would spend the **live**
Cloudinary's monthly allowance, and in a public repository an artifact can be
downloaded by anyone signed in to GitHub. The dated copy goes into the backup
project instead, which only the backup key can read.

Things to know:

- A failed scheduled run emails whoever last committed the workflow file.
- **GitHub disables scheduled workflows in a public repository after 60 days
  without a commit.** It emails a warning first; re-enable it from the Actions
  tab.
- `LIVE_FIREBASE_SERVICE_ACCOUNT` is currently the same key Cloud Run uses. If
  it ever leaks, replace it in **both** Secret Manager and GitHub. The better
  arrangement is a separate service account with only the *Cloud Datastore
  Viewer* role, which can read and nothing else.
- **The backup keys never go on Cloud Run.** They can write to the backups; a
  compromised server holding them could damage both copies.

### When you want one in hand — a laptop

```bash
npm run backup -- --dry-run            # what it would do
npm run backup -- --to a               # the nightly run, by hand
npm run backup -- --to a --local       # ...and a copy on this laptop too
```

The live keys come from `backend/.env`; add the `BACKUP_*` lines from
`backend/.env.example` for the targets. `--local` writes the dated database
file and downloads the photos to `backend/data/backups/` — the only copy that
does not depend on any account staying open. It is gitignored, and it holds
phone numbers, addresses and admin password hashes: **delete it when the job
it was made for is done**, because nothing prunes it until `--local` runs
there again.

Space, measured on 23 September 2026: **42 KB** per database copy (948
documents, gzipped) and **6.8 MB** of photos (94). `BACKUP_KEEP_DAYS` changes
the 30 and `BACKUP_KEEP_MONTHS` the 12. `BACKUP_KEEP_MONTHS` cannot go past 12:
the privacy policy (`frontend/src/legal/en.ts`, `mr.ts`) and the delete page
promise 12, so change them first and then the ceiling in `scripts/backup.ts`.

### Adding a second target

Create the Firebase project (with a Firestore database) and the Cloudinary
account, add `BACKUP_B_FIREBASE_SERVICE_ACCOUNT` and `BACKUP_B_CLOUDINARY_URL`
as secrets and as two lines in the workflow's `env:`, and set
`BACKUP_TARGETS: a,b`. Runs then alternate by day.

---

## 4. Restoring

**Before anything else, disable the Backup workflow** (Actions → Backup → ⋯ →
Disable workflow). Otherwise the next nightly run copies the damaged live data
over the good backup. The shrink check stops a wipe, not a subtler corruption.
Re-enable it once the live project is right again — and do not leave it off
for long: while it is off, nothing prunes the dated copies either.

Then **restore with a dry run first**, every time.

### The database, from the backup project

Run the script **in reverse**: the backup as the source, the live project as
the target. From a laptop, at the repository root:

```bash
FIREBASE_SERVICE_ACCOUNT="$(cat backup-a-key.json)" \
BACKUP_TARGETS=live \
BACKUP_LIVE_FIREBASE_SERVICE_ACCOUNT="$(cat live-key.json)" \
npm run backup -- --to live --no-copies --dry-run
```

Read what it would write and remove, then run it again without `--dry-run`.
Variables set on the command line take precedence over `backend/.env`, so
that file can stay as it is. Keep both key files outside the repository, and
delete them afterwards. `--no-copies` stops the run storing a dated copy of
everybody inside the live project; a target named `live` never gets one
either way. To restore a night older than the latest, use
`--snapshot <name>` (below) instead.

- It makes the live project **match the backup** — including removing
  anything created since the backup was taken. Orders placed between the last
  backup and the damage are lost unless they are still in the live project and
  you copy them first.
- **Then restart the API** so it reads the restored data, instead of writing
  its stale in-memory copy back over it: deploy a new revision, for example
  `gcloud run services update shantai-api --region asia-south1 --update-env-vars RESTORED_AT=<date>`.
  Do both at a quiet hour.
- Everybody is signed out, because `sessions` is not backed up.

**The other route**, if the live project itself is gone: point Cloud Run at
the backup project (a new version of the `FIREBASE_SERVICE_ACCOUNT` secret
holding the backup key, then a new revision). The backup project becomes the
live one, with its own Spark limits — and the GitHub secrets must be changed
to match **before** the workflow is re-enabled, or it will copy into the
project that is now live.

### Photos, from the backup Cloudinary

The same reverse run, with Cloudinary:

```bash
CLOUDINARY_URL="cloudinary://<backup key>:<backup secret>@e4bdb893" \
CLOUDINARY_FOLDER=shanta-mahila-bazar \
BACKUP_TARGETS=live \
BACKUP_LIVE_CLOUDINARY_URL="cloudinary://<live key>:<live secret>@<live cloud>" \
npm run backup -- --to live --no-copies --dry-run
```

It uploads every photo the live account is missing under its original
`public_id`, so the URLs stored in the database resolve again without changing
a document. Those URLs also carry a version number (`/v1726…/`); Cloudinary is
understood to ignore it when serving, but **this has not yet been tried** — a
restore drill is how to find out.

This works only while the live Cloudinary account (its cloud name) still
exists. If it is gone, every stored URL points at a dead account — see
*Not built: moving the photos to a new Cloudinary account* below.

### From a dated copy in the backup project

The route when the day wanted is older than last night — damage noticed a
week late. `npm run restore` reads the copies from the backup project named
by `BACKUP_<X>_FIREBASE_SERVICE_ACCOUNT` (add `--from a` if there is more than
one) and restores into whatever `FIREBASE_SERVICE_ACCOUNT` points at, exactly
as it restores a local file (below). **It reports and writes nothing unless
`--commit` is passed.**

```bash
npm run restore -- --snapshot list
npm run restore -- --snapshot firestore-2026-09-20T21-30.json.gz
npm run restore -- --snapshot firestore-2026-09-20T21-30.json.gz --commit
```

A copy listed as `INCOMPLETE` is one a run died writing; it cannot be
restored, and the next nightly run removes it.

### From the local files

`npm run restore` (`backend/scripts/restore.ts`) puts a `--local` run's
copies back — the route when the backup accounts are lost too. It restores
into whatever `backend/.env` points at: `FIREBASE_SERVICE_ACCOUNT` for the
database, `CLOUDINARY_*` for the photos. **It reports and writes nothing
unless `--commit` is passed.**

```bash
# the database, from a dated copy
npm run restore -- --file backend/data/backups/firestore-2026-09-23T17-41.json.gz

# the photos, from backend/data/backups/images/
npm run restore -- --images

# both, for real
npm run restore -- --file backend/data/backups/<file>.json.gz --images --commit
```

The dry run prints each collection's count in the file beside its count in
the project, then what it would write and remove. Read it before `--commit`.

- **The database is made to match the file**, the same as the reverse run
  above: documents that differ are written, documents the file lacks are
  removed. Collections the file does not have are left alone, and `sessions`
  is never touched — a restore does not sign anybody out.
- **It refuses a file much smaller than the project** — more than half of any
  collection gone — because that is the wrong file or the wrong project far
  more often than a restore. `ALLOW_BULK_DELETE=true` if it is neither.
- **Photos are only added.** Each goes back under the `public_id` it was saved
  from; one the account already has is left as it is. Into the **same**
  account, that is the whole fix. Into a **different** one, the photos are
  there but the database still points at the old account — the next section.
- **Then restart the API**, as above. The script prints the command.

To look at a copy instead of restoring it, unpack it into `db.json`; with no
`FIREBASE_*` variables set, `npm run dev:api` then runs the whole app on that
day's shop:

```bash
node -e "process.stdout.write(require('zlib').gunzipSync(require('fs').readFileSync(process.argv[1])))" backend/data/backups/<file>.json.gz > backend/data/db.json
```

### Not built: moving the photos to a new Cloudinary account

Every photo the app shows is a **full URL stored in Firestore**, and a URL
names the account it lives in:

```
https://res.cloudinary.com/<cloud name>/image/upload/v1726…/shanta-mahila-bazar/product/abc123.jpg
```

So restoring the photos into a **different** Cloudinary account — the
backup one, or a new one — puts them back, but every stored URL still points
at the old account, and the app shows none of them. That happens when the
live account itself is lost, closed or locked, not in any other restore. Until
it is built, the answer is to keep the live account alive: its login must be
known to more than one person, like the backup accounts'.

What building it means, measured on the copy of 23 September 2026:

| Field | Documents with a Cloudinary URL |
|---|---|
| `products.imageUrl` | 33 |
| `sellers.upiQrUrl` | 4 |
| `payments.screenshotUrl` | 6 |
| `sellers.photo` | 0 today; the field exists and would need the same treatment if it ever holds one |

- **Replace the prefix only**: `https://res.cloudinary.com/<old>/` becomes
  `https://res.cloudinary.com/<new>/`. The rest of the URL — the version, the
  folder, the `public_id` — stays as it is, because `restore --images` and the
  backup both keep every `public_id`. `imagePublicId` and `upiQrPublicId`
  carry no account name and need no change.
- **Search every string in every document**, not just the three fields, and
  report any other field it finds: a URL copied somewhere new since this was
  written is exactly what a field list would miss.
- **Behave like `restore`**: a dry run by default that prints what it would
  change per field, `--commit` to write, only changed documents written
  (`applyMirror` in `backupIo.ts` does that), and the API restarted afterwards,
  because it holds the old URLs in memory.
- **Switch the live settings at the same time**: `CLOUDINARY_URL` (or
  `CLOUDINARY_*`) on Cloud Run to the new account, so new uploads go there.
  `screenshotProblem()` in `backend/src/db/payments.ts` checks a new
  screenshot against the configured cloud name, so it follows by itself;
  screenshots already approved are not checked again.
- **Then the backups**: the backup Cloudinary becomes the account the app
  depends on — it should stop being a backup target, and a new backup account
  take its place, before the nightly workflow is re-enabled.
- `frontend/src/lib/upload.ts` inserts resizing options after
  `/image/upload/` when it draws a photo. It keeps the host and the cloud
  name, so it needs no change.

### Practise it

Before the day it is needed, restore once into **backup A** — it is the one
place a practice write does no harm, because the next nightly run puts live
back over it. From a laptop, with backup A's key and Cloudinary URL on the
command line in place of the live ones:

```bash
FIREBASE_SERVICE_ACCOUNT="$(cat backup-a-key.json)" \
CLOUDINARY_URL="cloudinary://<backup key>:<backup secret>@e4bdb893" \
npm run restore -- --file backend/data/backups/<file>.json.gz --images
```

The file comes from a `--local` run made for the drill; restoring a stored
copy (`--snapshot <name>`) into backup A works the same way and needs no
file. The dry run should name `smb-backup-99778` and `e4bdb893`, never the
live ones — if it names the live project, stop. Then add `--commit`, point a
local API at backup A (`npm run dev:api` with that key) and look around. That
is also the test of the photo URLs. **Delete the local files when you are
done.**

---

## 5. When it fails

| The log says | Meaning |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64 JSON` and `target "a" has a Firebase key, but the live Firebase is not configured` | The `LIVE_FIREBASE_SERVICE_ACCOUNT` secret was pasted with something extra — the `FIREBASE_SERVICE_ACCOUNT=` prefix, or quotes. Copy the exact value with `node --env-file=backend/.env -e "process.stdout.write(process.env.FIREBASE_SERVICE_ACCOUNT)" \| clip` and update the secret. |
| `copies → <project>: …` | Storing or pruning the dated copies failed; the mirror still ran. Read the Firestore error — usually the backup project's daily write limit, or a missing Firestore database. Until a run succeeds, nothing is being pruned. |
| `cloudinary not configured` | One of the three `LIVE_CLOUDINARY_*` secrets is missing or misspelled. |
| `the live project has shrunk since this backup was taken` | A collection lost more than half its documents. **Find out why before doing anything else** — this is what 10 September looked like. If the shrink was deliberate (a purge), run once with `ALLOW_BULK_DELETE=true`. |
| `is the LIVE Firebase project - refusing` / `is the LIVE Cloudinary account - refusing` | A backup secret holds the live key. |
| `backup target "a" has neither a Firebase key nor a Cloudinary URL` | `BACKUP_TARGETS` names a target whose secrets are not in the workflow's `env:`. |
| A Firestore error on the backup project | Its Firestore database was never created (Build → Firestore Database), or its Spark write limit (20,000 a day) is spent. |
| No run at 03:00 | Scheduled workflows start late when GitHub is busy, can skip their first slot, and stop after 60 days without a commit. |

`SESSION_SECRET is not set` in the log is harmless: the backup signs nothing.
