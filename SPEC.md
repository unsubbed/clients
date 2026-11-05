# Unsubbed Clients — spec

A free alternative to HoneyBook and Dubsado: proposals, contracts and invoices for freelancers and small studios, made in the browser and saved as PDFs. No account, no server, no monthly fee. Client details stay on the device.

## 0. Decisions made by the agent (for Zabir to check at Gate 5)
- App color **Magenta** `#c2187a` / dark `#ff7ac0`. Avoids HoneyBook's yellow and purple and every earlier Unsubbed app (emerald, coral, violet, cobalt).
- **PDFs come from the browser's own "Save as PDF"** (print dialog), not a bundled PDF library. No dependency, and every language and alphabet works. The file name is filled in for you.
- **No online client signing and no card payments.** Both need a server, and that breaks the no-server rule. Instead: both sides can sign on this device or on paper, and the invoice shows your own payment instructions.
- **Contract starter text is a plain starting point and is labeled "not legal advice".** Drawn signatures have no audit trail, and the app says so.
- Each document keeps its own currency, so changing the default never rewrites old paperwork. Totals are shown per currency, never added across currencies.

## 1. Who and why
Freelancers who need to send a proposal, get a contract signed and bill for the work, and don't want a monthly subscription or to hand client data to a company.

## 2. KEEP (functional) vs CHANGE (expressive)
| Area | KEEP (how it works) | CHANGE (how it looks / what it's called) |
|---|---|---|
| Paperwork | Proposal → contract → invoice for a client, carrying the line items across | One-click "Turn into…" on a single-page **desk**, no project pipeline or client portal |
| Editing | Fill in fields, see the document | **Form beside a live sheet of paper**; on phones an Edit / Paper switch |
| Invoices | Line items, discount, tax, due date, payment plan, paid tracking | Our own "Payment plan" rows with percent and tick-when-paid; overdue always said in words, not color alone |
| Contracts | Editable text, sign | Our own starter text with `{{client}}`-style blanks; draw a signature or sign on paper |
| Clients | Contact records | A plain address book tab |
| Overview | What's unpaid and overdue | A flat **money strip** across the top, not a dashboard of widgets |
| Data | Export | `.json` Save/Open (kit), invoice CSV, PDFs |
| Settings | Business details and branding | In the kit's Settings dialog |

## 3. Screens (hash routes, so the phone's back button works)
- `#/` **Desk**: money strip (Unpaid · Overdue · Paid this year). Filter chips All / Proposals / Contracts / Invoices. Buttons New proposal / New contract / New invoice. Table: number, title, client, date, amount, status (word chip). Export invoices CSV. Empty: "No paperwork yet." with the three New buttons and "Load an example".
- `#/clients` **Clients**: list on the left, form on the right (name, company, email, phone, address, notes). Add, delete. Deleting a client who has paperwork is refused with a toast saying how many documents use them.
- `#/doc/<id>` **Document**: action row (Back, Save as PDF, Email draft, Turn into…, Duplicate, Delete), form left, paper right. Desktop ≥ 980 px: two columns with sticky paper. Phone: Edit / Paper switch.
- A bar on the Desk says "Add your business details" until a business name is set; it opens Settings.

## 4. Document fields
All: client (select, with "New client…" that goes to the Clients tab), number (auto, editable), title, date, status, currency, line items (description, quantity, price), discount %, tax %, notes.
- **Proposal**: intro text, valid-until date. Status Draft / Sent / Accepted / Declined. Signature block for client acceptance.
- **Contract**: body text from a starter, with blanks `{{client}}`, `{{business}}`, `{{date}}`, `{{total}}`. Items optional; the fee table shows only when there are items. Status Draft / Sent / Signed. Lines starting `# ` print as headings.
- **Invoice**: due date, payment instructions (default from business), payment plan rows (label, percent, due date, paid tick). Status Draft / Sent / Paid. Ticking all rows sets Paid. Percents not adding up to 100 shows a warning.
- **Signatures** (proposal and contract): for each side, printed name, date signed and a drawing pad with Clear. Drawing shows the image; date without drawing shows "/s/ Name" (keyboard-friendly); neither leaves a blank line to sign on paper.

## 5. Engine (`clients.js`, pure functions, tested in `clients.test.mjs`)
Money is whole cents. `toCents`, `totals(doc)` (subtotal, discount, tax on the discounted amount, total), `planAmounts(total, plan)` (the last row takes the remainder when percents total 100, so rows always add up exactly), `invoiceState(doc, today)` (total, paid, balance, overdue, label: Draft / Sent / Part paid / Overdue / Paid), `summary(docs, today)` per currency, `nextNumber(docs, type)` (PRO-/CON-/INV- + 4 digits, one above the highest), `fill(text, values)`, `csv(rows)` (RFC 4180 with formula guard), `clean(state)` (trust boundary for storage and files).
Drafts never count as money owed.

## 6. Files and privacy
- `localStorage` via the kit (id `clients`). Save: `unsubbed-clients.json`. Open: same file, replaces data after a confirm; invalid file → kit toast, nothing changed.
- Logo upload (PNG/JPEG): redrawn to at most 400 px PNG through a canvas. Signatures are small PNGs. On load only `data:image/png;base64,` images are accepted.
- All user text is rendered as text, never as HTML.
- Email draft opens the mail app with a subject and short note; the user attaches the PDF. Nothing is sent by the app.

## 7. Settings (kit dialog `#app-settings`)
Your business: name, email, phone, address, tax ID, logo; defaults: currency, tax %, payment instructions.

## 8. Words (our own)
App name Unsubbed Clients. Tagline: "Proposals, contracts and invoices you don't pay a monthly fee for." Never name the incumbents except the footer legal line, README and meta description.

## 9. Not in scope (known limits)
Online signing, client portal, card payments, automatic reminders, scheduling, lead forms, recurring invoices, sync between devices. Editing a client or your business details changes how older documents print.

## 10. Tech
`index.html`, `app.css` (`:root { --app:#c2187a; --app-dark:#ff7ac0; }` + layout + print), `app.js` (UI), `clients.js` (engine, plain script with a `module.exports` guard), `clients.test.mjs`. No dependencies. Kit CSP kept; no inline styles. Port 5105.
