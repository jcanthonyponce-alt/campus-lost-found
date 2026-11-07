# Campus Lost & Found

Dashboard app with full CRUD for reporting and recovering lost items on campus.
Built with **Express.js** and **SQLite** (built-in node:sqlite), vanilla HTML/CSS/JS frontend.

## Features
- **Create / Read / Update / Delete** items (lost and found reports) with photo upload
- **Dashboard** with status counts, search, and status/category filters
- **Claims with evidence**: name, contact number, address, ID type and number, ID photo, proof photo, ownership details
- **Admin review**: approve or reject claims; competing claims mark an item as *Disputed* so evidence can be compared side by side
- **Archive and Restore**: soft delete with a required reason; restore with a reason if a dispute comes up
- **Permanent delete** only from the archive
- **History log** per item (created, edited, claim submitted, approved, rejected, archived, restored)
- Admin login (hashed password, session based). ID and proof photos are served to admins only.

## Run it
Requires Node.js 22.13 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000

Default admin account (created on first run): **admin / admin123**
Change it with environment variables before the first run:

```bash
ADMIN_USER=myadmin ADMIN_PASS=strongpass SESSION_SECRET=anything npm start
```
(Windows PowerShell: `$env:ADMIN_PASS="strongpass"; npm start`)

## Item statuses
Lost, Found, Pending Claim, Disputed, Claimed, Returned (archived items are hidden from the main list).

## Claim workflow
1. Anyone can open a *Found* item and submit a claim with evidence.
2. Item becomes *Pending Claim* (or *Disputed* if more than one pending claim).
3. Admin opens the item, reviews the ID photo, proof and description, then approves or rejects.
4. Approving sets the item to *Claimed* and auto-rejects other pending claims. Admin edits the item to *Returned* on handover.

## Database
`items`, `claims`, `item_history`, `admins` (SQLite file `lostfound.db`, created automatically).

## Privacy
`uploads/` and `*.db` are in `.gitignore`. Use fake IDs and photos in your demo.
