// Unsubbed Clients UI. Money and validation live in clients.js; this file renders and stores.
// All user text goes through textContent or form values, never innerHTML.
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return el;
};

const WORDS = { proposal: 'Proposal', contract: 'Contract', invoice: 'Invoice' };
const PLURAL = { proposal: 'Proposals', contract: 'Contracts', invoice: 'Invoices' };
const STARTER = `# What this covers
{{business}} will carry out the work described here for {{client}}, starting on {{date}}.

[Describe the work: what you will hand over, and by when.]

# Fee and payment
The fee is {{total}}. {{client}} pays against the invoices {{business}} sends, by the dates on them.

# Changes
Work beyond this description is extra. Both sides agree it in writing, price included, before it starts.

# Who owns what
Once the fee is paid in full, {{client}} owns the final work. {{business}} keeps its tools and methods, and may show the work in a portfolio unless asked not to.

# Keeping things private
Each side keeps the other's private information to itself, during this work and after it.

# Ending early
Either side can end this agreement with 14 days' written notice. {{client}} pays for the work done up to that day.

# Limits
Neither side is liable for indirect losses. The most {{business}} can owe under this agreement is the fee paid.

# Which law applies
[Your state or country] law applies to this agreement.`;

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const newId = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
const blank = () => Clients.clean({ clients: [], docs: [] });
const money = (cents, cur) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(cents / 100);
const niceDate = (iso) => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', dateStyle: 'medium' }) : '');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

let data = blank(), filter = 'all', doc = null, client = null, returnDoc = null;
const clientOf = (d) => data.clients.find((c) => c.id === d.clientId);
const clientName = (c) => (c ? c.name || c.company || 'No name yet' : '');

function newDoc(type, from = {}) {
  const t = today(), b = data.business;
  const d = Clients.clean({ clients: [], docs: [{
    id: newId(), type, status: 'draft', date: t, number: Clients.nextNumber(data.docs, type),
    title: from.title || '', clientId: from.clientId || '', currency: from.currency || b.currency,
    items: from.items?.length ? structuredClone(from.items) : type === 'contract' ? [] : [{ desc: '', qty: 1, price: 0 }],
    discount: from.discount || 0, tax: from.tax ?? b.tax,
    body: type === 'contract' ? STARTER : '',
    due: type === 'invoice' ? Clients.addDays(t, 14) : '',
    validUntil: type === 'proposal' ? Clients.addDays(t, 30) : '',
    payNote: type === 'invoice' ? b.payNote : '',
    sigMe: { name: b.name }, sigClient: { name: clientName(data.clients.find((c) => c.id === from.clientId)) },
  }] }).docs[0];
  data.docs.unshift(d);
  kit.store();
  location.hash = `#/doc/${d.id}`;
}

// ---- Routing: the hash keeps the phone's back button working.
function route() {
  const [, view, id] = location.hash.split('/');
  doc = view === 'doc' ? data.docs.find((d) => d.id === id) || null : null;
  const name = doc ? 'doc' : view === 'clients' ? 'clients' : 'desk';
  for (const v of ['desk', 'clients', 'doc']) $(`#v-${v}`).hidden = v !== name;
  $$('[data-tab]').forEach((a) => (a.dataset.tab === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (name === 'desk') renderDesk();
  if (name === 'clients') renderClients();
  if (name === 'doc') openDoc();
  scrollTo(0, 0);
  return name;
}
addEventListener('hashchange', () => $(`#v-${route()} .cl-h`).focus({ preventScroll: true }));

// ---- Desk
function renderDesk() {
  const sum = Clients.summary(data.docs, today());
  const pick = (k) => Object.entries(sum).filter(([, s]) => s[k] > 0).map(([c, s]) => money(s[k], c)).join(' · ') || '—';
  const overdue = pick('overdue');
  $('#strip').replaceChildren(
    h('div', {}, h('dt', { textContent: 'Waiting to be paid' }), h('dd', { textContent: pick('unpaid') })),
    h('div', { className: overdue === '—' ? '' : 'late' }, h('dt', { textContent: 'Overdue' }), h('dd', { textContent: overdue })),
    h('div', {}, h('dt', { textContent: "Paid on this year's invoices" }), h('dd', { textContent: pick('paidYear') })),
  );
  $('#nudge').hidden = !!data.business.name;
  const none = !data.docs.length;
  $('#strip').hidden = none;
  $('#desk-empty').hidden = !none;
  $('#desk-list').hidden = none;
  $('#filters').replaceChildren(...[['all', 'All'], ...Object.entries(PLURAL)].map(([k, label]) => {
    const b = h('button', { type: 'button', textContent: label });
    b.setAttribute('aria-pressed', filter === k);
    b.onclick = () => { filter = k; renderDesk(); };
    return b;
  }));
  const rows = data.docs.filter((d) => filter === 'all' || d.type === filter);
  $('#doc-table').hidden = !rows.length;
  $('#filter-none').hidden = !!rows.length;
  $('#doc-table tbody').replaceChildren(...rows.map((d) => {
    const label = d.type === 'invoice' ? Clients.invoiceState(d, today()).label : cap(d.status);
    return h('tr', { className: label === 'Overdue' ? 'late' : '' },
      h('td', { className: 'cl-num' }, h('a', { href: `#/doc/${d.id}`, textContent: d.number || 'No number' })),
      h('td', { textContent: d.title || WORDS[d.type] }),
      h('td', { textContent: clientName(clientOf(d)) }),
      h('td', { textContent: niceDate(d.date) }),
      h('td', { className: 'num', textContent: d.items.length ? money(Clients.totals(d).total, d.currency) : '' }),
      h('td', {}, h('span', { className: `u-chip st-${label.toLowerCase().replace(' ', '-')}`, textContent: label })));
  }));
}
$$('[data-new]').forEach((b) => (b.onclick = () => newDoc(b.dataset.new)));
$('#nudge-btn').onclick = () => $('[data-settings]').click();
$('#csv').onclick = () => {
  const inv = data.docs.filter((d) => d.type === 'invoice');
  if (!inv.length) return kit.toast('No invoices yet');
  const dec = (c) => (c / 100).toFixed(2);
  kit.download('unsubbed-clients-invoices.csv', Clients.csv([
    ['Number', 'Title', 'Client', 'Date', 'Due', 'Status', 'Currency', 'Total', 'Paid', 'Balance'],
    ...inv.map((d) => {
      const s = Clients.invoiceState(d, today());
      return [d.number, d.title, clientName(clientOf(d)), d.date, d.due, s.label, d.currency, dec(s.total), dec(s.paid), dec(s.balance)];
    }),
  ]), 'text/csv');
};
$('#example').onclick = () => {
  const t = today(), id = newId();
  data.business.name ||= 'Rowan Studio';
  data.business.email ||= 'hello@rowan.example';
  data.business.payNote ||= 'Bank transfer to Rowan Studio, account 00-0000, or ask for a payment link.';
  data.clients.push({ id, name: 'Sam Reyes', company: 'Juniper Bakery', email: 'sam@juniper.example', phone: '', address: '12 Mill Lane', notes: '' });
  const items = [{ desc: 'New logo and colors', qty: 1, price: 120000 }, { desc: 'Menu design, per page', qty: 4, price: 15000 }];
  const base = { clientId: id, title: 'Bakery rebrand', currency: data.business.currency, items, sigMe: { name: data.business.name }, sigClient: { name: 'Sam Reyes' } };
  data.docs = Clients.clean({ clients: [], docs: [
    { ...base, id: newId(), type: 'invoice', number: 'INV-0001', status: 'sent', date: Clients.addDays(t, -30), due: Clients.addDays(t, -2), payNote: data.business.payNote,
      plan: [{ label: 'Deposit', pct: 50, due: Clients.addDays(t, -30), paid: true }, { label: 'On handover', pct: 50, due: Clients.addDays(t, -2), paid: false }] },
    { ...base, id: newId(), type: 'contract', number: 'CON-0001', status: 'signed', date: Clients.addDays(t, -34), body: STARTER,
      sigMe: { ...base.sigMe, date: Clients.addDays(t, -34) }, sigClient: { ...base.sigClient, date: Clients.addDays(t, -33) } },
    { ...base, id: newId(), type: 'proposal', number: 'PRO-0001', status: 'accepted', date: Clients.addDays(t, -40), validUntil: Clients.addDays(t, -10),
      intro: 'A warmer look for the bakery: a new logo, a color set for the shop and a menu people can read from the counter.' },
  ] }).docs;
  fillSettings();
  kit.store();
  renderDesk();
  kit.toast('Example loaded. Clear it in Settings when you are done.');
};

// ---- Clients
function renderClients() {
  $('#client-none').hidden = !!data.clients.length;
  $('#client-list').replaceChildren(...data.clients.map((c) => {
    const b = h('button', { type: 'button', textContent: clientName(c) });
    if (c === client) b.setAttribute('aria-current', 'true');
    b.onclick = () => { client = c; renderClients(); };
    return h('li', {}, b);
  }));
  const f = $('#client-form');
  if (!data.clients.includes(client)) client = null;
  f.hidden = !client;
  if (client) for (const k of ['name', 'company', 'email', 'phone', 'address', 'notes']) f.elements[k].value = client[k];
  const back = $('#client-back');
  back.hidden = !returnDoc;
  if (returnDoc) back.href = `#/doc/${returnDoc}`;
}
function addClient() {
  client = { id: newId(), name: '', company: '', email: '', phone: '', address: '', notes: '' };
  data.clients.push(client);
  kit.store();
}
$('#add-client').onclick = () => {
  returnDoc = null;
  addClient();
  renderClients();
  $('#client-form').elements.name.focus();
};
$('#client-form').oninput = (e) => {
  client[e.target.name] = e.target.value;
  kit.store();
  $('#client-list [aria-current]').textContent = clientName(client);
};
$('#client-form').onsubmit = (e) => e.preventDefault();
$('#del-client').onclick = () => {
  const used = data.docs.filter((d) => d.clientId === client.id).length;
  if (used) return kit.toast(`${used} document${used === 1 ? ' uses' : 's use'} this client. Delete ${used === 1 ? 'it' : 'them'} first.`);
  if (!confirm(`Delete ${clientName(client)}?`)) return;
  data.clients = data.clients.filter((c) => c !== client);
  client = null;
  kit.store();
  renderClients();
};

// ---- Document form. Built once per document so typing never loses focus; only the paper redraws.
const form = $('#doc-form');
const FIELDS = ['clientId', 'title', 'number', 'status', 'date', 'validUntil', 'due', 'intro', 'body', 'discount', 'tax', 'currency', 'payNote', 'notes'];
const numberOr0 = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function setOptions(sel, opts) {
  sel.replaceChildren(...opts.map(([value, text]) => h('option', { value, textContent: text })));
}

function openDoc() {
  returnDoc = null;
  doc.sigClient.name ||= clientName(clientOf(doc));
  $('#doc-h').textContent = `${WORDS[doc.type]} ${doc.number}`;
  setOptions(form.elements.clientId, [['', 'Choose a client'], ...data.clients.map((c) => [c.id, clientName(c)]), ['__new', 'New client…']]);
  setOptions(form.elements.status, Clients.STATUSES[doc.type].map((s) => [s, cap(s)]));
  setOptions(form.elements.currency, Clients.CURRENCIES.map((c) => [c, c]));
  for (const k of FIELDS) form.elements[k].value = doc[k];
  $$('#doc-form [data-for]').forEach((el) => (el.hidden = !el.dataset.for.split(' ').includes(doc.type)));
  $('#to-contract').hidden = doc.type !== 'proposal';
  $('#to-invoice').hidden = doc.type === 'invoice';
  setPane('edit');
  renderItems();
  renderPlan();
  renderSig('sigMe', $('#sig-me-box'));
  renderSig('sigClient', $('#sig-client-box'));
  renderPaper();
}

function rowInput(label, value, on, extra = {}) {
  const el = h('input', { value, ...extra, ariaLabel: label });
  el.addEventListener('input', () => { on(el); changed(); });
  return el;
}
const X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
function removeBtn(label, on) {
  return h('button', { type: 'button', className: 'u-btn icon cl-x', ariaLabel: label, title: label, innerHTML: X_ICON, onclick: on });
}
function renderItems() {
  $('#items').replaceChildren(...doc.items.map((it, i) => h('div', { className: 'cl-item' },
    rowInput(`Line ${i + 1} description`, it.desc, (e) => (it.desc = e.value), { className: 'd', placeholder: 'What for' }),
    rowInput(`Line ${i + 1} quantity`, it.qty, (e) => (it.qty = clamp(numberOr0(e.value), 0, 1e6)), { className: 'q', type: 'number', min: 0, step: 'any', inputMode: 'decimal' }),
    rowInput(`Line ${i + 1} price`, (it.price / 100).toFixed(2), (e) => (it.price = clamp(Clients.toCents(e.value), 0, 1e11)), { className: 'p', type: 'number', min: 0, step: 'any', inputMode: 'decimal' }),
    removeBtn(`Remove line ${i + 1}`, () => { doc.items.splice(i, 1); renderItems(); changed(); }))));
}
function renderPlan() {
  $('#plan').replaceChildren(...doc.plan.map((r, i) => {
    const paid = h('input', { type: 'checkbox', checked: r.paid });
    paid.onchange = () => {
      r.paid = paid.checked;
      if (doc.status === 'draft' && paid.checked) doc.status = 'sent'; // money received means it went out
      if (doc.plan.every((x) => x.paid) && Clients.planPercent(doc.plan) === 100) doc.status = 'paid';
      else if (doc.status === 'paid' && !paid.checked) doc.status = 'sent';
      form.elements.status.value = doc.status;
      changed();
    };
    return h('div', { className: 'cl-part' },
      rowInput(`Part ${i + 1} name`, r.label, (e) => (r.label = e.value), { className: 'd', placeholder: 'Deposit' }),
      rowInput(`Part ${i + 1} percent`, r.pct, (e) => (r.pct = clamp(numberOr0(e.value), 0, 100)), { className: 'q', type: 'number', min: 0, max: 100, step: 'any', inputMode: 'decimal' }),
      rowInput(`Part ${i + 1} due date`, r.due, (e) => (r.due = Clients.okDate(e.value) ? e.value : ''), { className: 'p', type: 'date' }),
      h('label', { className: 'cl-paid' }, paid, h('span', { textContent: 'Paid' })),
      removeBtn(`Remove part ${i + 1}`, () => { doc.plan.splice(i, 1); renderPlan(); changed(); }));
  }));
}

function renderSig(key, box) {
  const s = doc[key];
  const canvas = h('canvas', { width: 480, height: 140, className: 'cl-pad', ariaLabel: 'Draw a signature here' });
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14141a';
  if (s.img) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = s.img; }
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
  };
  let drawing = false, moved = false;
  canvas.onpointerdown = (e) => { drawing = true; moved = false; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...at(e)); };
  canvas.onpointermove = (e) => { if (drawing) { moved = true; ctx.lineTo(...at(e)); ctx.stroke(); } };
  canvas.onpointerup = canvas.onpointercancel = () => {
    if (!drawing || !moved) { drawing = false; return; } // a tap isn't a signature
    drawing = false;
    s.img = canvas.toDataURL('image/png');
    changed();
  };
  const clear = h('button', { type: 'button', className: 'u-btn', textContent: 'Clear drawing', onclick: () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    s.img = '';
    changed();
  } });
  box.replaceChildren(box.querySelector('legend'),
    h('div', { className: 'cl-two' },
      h('label', { className: 'u-field' }, h('span', { textContent: 'Name' }), rowInput('Printed name', s.name, (e) => (s.name = e.value))),
      h('label', { className: 'u-field' }, h('span', { textContent: 'Date signed' }), rowInput('Date signed', s.date, (e) => (s.date = Clients.okDate(e.value) ? e.value : ''), { type: 'date' }))),
    canvas, h('div', { className: 'u-row' }, clear));
}

form.addEventListener('input', (e) => {
  const k = e.target.name;
  if (!FIELDS.includes(k)) return;
  if (k === 'clientId' && e.target.value === '__new') {
    returnDoc = doc.id;
    addClient();
    doc.clientId = client.id;
    kit.store();
    location.hash = '#/clients';
    return;
  }
  const oldName = clientName(clientOf(doc));
  doc[k] = k === 'discount' || k === 'tax' ? clamp(numberOr0(e.target.value), 0, 100) : e.target.value;
  if (k === 'clientId' && (!doc.sigClient.name || doc.sigClient.name === oldName)) {
    doc.sigClient.name = clientName(clientOf(doc));
    renderSig('sigClient', $('#sig-client-box'));
  }
  if (k === 'number') $('#doc-h').textContent = `${WORDS[doc.type]} ${doc.number}`;
  changed();
});
form.onsubmit = (e) => e.preventDefault();
function changed() {
  kit.store();
  renderPaper();
}
$('#add-item').onclick = () => { doc.items.push({ desc: '', qty: 1, price: 0 }); renderItems(); changed(); $('#items .cl-item:last-child .d').focus(); };
$('#add-plan').onclick = () => {
  const left = Math.max(0, 100 - Clients.planPercent(doc.plan));
  doc.plan.push({ label: '', pct: left, due: doc.due, paid: false });
  renderPlan(); changed();
  $('#plan .cl-part:last-child .d').focus();
};

// ---- The paper. Same element on screen and in print.
function blockOf(lines) {
  return lines.filter(Boolean).map((l) => h('div', { textContent: l }));
}
function textBlock(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('# ')) out.push(h('h3', { textContent: line.slice(2) }));
    else if (line.trim()) out.push(h('p', { textContent: line }));
  }
  return out;
}
function signatureBlock(title, s) {
  const name = s.name || title;
  const mark = s.img ? h('img', { src: s.img, alt: `Signature of ${name}` })
    : s.date ? h('span', { className: 'typed', textContent: `/s/ ${name}` }) : null;
  return h('div', { className: 'sig' },
    h('div', { className: 'sig-who', textContent: title }),
    h('div', { className: 'sig-line' }, mark),
    h('div', { textContent: name }),
    h('div', { className: 'sig-date', textContent: s.date ? niceDate(s.date) : 'Date:' }));
}
function renderPaper() {
  const b = data.business, c = clientOf(doc), cur = doc.currency, t = Clients.totals(doc);
  const lines = doc.items.filter((i) => i.desc || i.price);
  const m = (x) => money(x, cur);
  const dates = [['Date', niceDate(doc.date)]];
  if (doc.type === 'proposal' && doc.validUntil) dates.push(['Good until', niceDate(doc.validUntil)]);
  if (doc.type === 'invoice' && doc.due && !doc.plan.length) dates.push(['Due', niceDate(doc.due)]);

  const parts = [
    h('header', { className: 'p-head' },
      h('div', { className: 'p-from' },
        b.logo ? h('img', { className: 'p-logo', src: b.logo, alt: '' }) : null,
        h('strong', { textContent: b.name || 'Your business name' }),
        blockOf([b.address, b.email, b.phone, b.taxId && `Tax ID ${b.taxId}`])),
      h('div', { className: 'p-kind' },
        h('div', { className: 'p-word', textContent: WORDS[doc.type] }),
        h('div', { className: 'p-no', textContent: doc.number }),
        h('dl', {}, dates.map(([k, v]) => [h('dt', { textContent: k }), h('dd', { textContent: v })])))),
    h('section', { className: 'p-for' },
      h('div', { className: 'p-label', textContent: 'For' }),
      h('strong', { textContent: c ? c.name || c.company : 'Your client' }),
      c ? blockOf([c.name && c.company, c.address, c.email, c.phone]) : null),
    doc.title ? h('h2', { className: 'p-title', textContent: doc.title }) : null,
  ];
  if (doc.type === 'proposal' && doc.intro) parts.push(h('div', { className: 'p-text' }, textBlock(doc.intro)));
  if (doc.type === 'contract') {
    parts.push(h('div', { className: 'p-text' }, textBlock(Clients.fill(doc.body, {
      client: c ? c.company || c.name || 'the client' : 'the client',
      business: b.name || 'the business',
      date: niceDate(doc.date),
      total: lines.length ? m(t.total) : 'the agreed fee',
    }))));
  }
  if (lines.length) {
    const sums = [['Subtotal', t.sub]];
    if (t.discount) sums.push([`Discount ${doc.discount}%`, -t.discount]);
    if (t.tax) sums.push([`Tax ${doc.tax}%`, t.tax]);
    parts.push(h('table', { className: 'p-items' },
      h('thead', {}, h('tr', {}, h('th', { textContent: 'Item' }), h('th', { className: 'num', textContent: 'Qty' }), h('th', { className: 'num', textContent: 'Price' }), h('th', { className: 'num', textContent: 'Amount' }))),
      h('tbody', {}, lines.map((i) => h('tr', {},
        h('td', { textContent: i.desc }), h('td', { className: 'num', textContent: i.qty }), h('td', { className: 'num', textContent: m(i.price) }), h('td', { className: 'num', textContent: m(Math.round(i.qty * i.price)) }))))));
    parts.push(h('dl', { className: 'p-sums' },
      (sums.length > 1 ? sums : []).map(([k, v]) => [h('dt', { textContent: k }), h('dd', { textContent: m(v) })]),
      h('dt', { className: 'total', textContent: 'Total' }), h('dd', { className: 'total', textContent: m(t.total) })));
  }
  if (doc.type === 'invoice') {
    const s = Clients.invoiceState(doc, today()), amounts = Clients.planAmounts(t.total, doc.plan);
    if (s.paid > 0 && s.balance > 0) parts.push(h('dl', { className: 'p-sums' }, h('dt', { textContent: 'Paid so far' }), h('dd', { textContent: m(s.paid) }), h('dt', { className: 'total', textContent: 'Still to pay' }), h('dd', { className: 'total', textContent: m(s.balance) })));
    if (s.label === 'Paid') parts.push(h('p', { className: 'p-stamp', textContent: 'Paid in full' }));
    if (doc.plan.length) {
      parts.push(h('h3', { className: 'p-sub', textContent: 'Payment plan' }), h('table', { className: 'p-items p-plan' }, h('tbody', {}, doc.plan.map((r, i) => h('tr', {},
        h('td', { textContent: r.label || `Part ${i + 1}` }), h('td', { textContent: r.due ? `Due ${niceDate(r.due)}` : '' }), h('td', { className: 'num', textContent: m(amounts[i]) }), h('td', { className: 'num', textContent: r.paid || doc.status === 'paid' ? 'Paid' : '' }))))));
    }
    if (doc.payNote) parts.push(h('h3', { className: 'p-sub', textContent: 'How to pay' }), h('div', { className: 'p-text' }, textBlock(doc.payNote)));
    const pct = Clients.planPercent(doc.plan), warn = $('#plan-warn');
    warn.hidden = !doc.plan.length || pct === 100;
    warn.textContent = `These parts add up to ${+pct.toFixed(2)}%. They should add up to 100%.`;
  }
  if (doc.notes) parts.push(h('div', { className: 'p-text p-notes' }, textBlock(doc.notes)));
  if (doc.type !== 'invoice') {
    parts.push(h('div', { className: 'p-sigs' },
      signatureBlock(b.name || 'Your business', doc.sigMe),
      signatureBlock(c ? c.company || c.name || 'Client' : 'Client', doc.sigClient)));
  }
  $('#paper').replaceChildren(...parts.filter(Boolean));
}

// ---- Document actions
function setPane(p) {
  $('#work').dataset.pane = p;
  $$('.cl-switch button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pane === p));
}
$$('.cl-switch button').forEach((b) => (b.onclick = () => setPane(b.dataset.pane)));
const APP_TITLE = 'Unsubbed Clients · Unsubbed';
$('#pdf').onclick = () => {
  // The title becomes the suggested PDF file name.
  const c = clientOf(doc);
  document.title = [doc.number, c && (c.company || c.name)].filter(Boolean).join(' ') || WORDS[doc.type];
  addEventListener('afterprint', () => (document.title = APP_TITLE), { once: true });
  print();
};
$('#mail').onclick = () => {
  const c = clientOf(doc), b = data.business;
  if (!c || !Clients.okEmail(c.email)) return kit.toast('Add one valid email address for this client first');
  const what = `${WORDS[doc.type]} ${doc.number}`, lower = `${WORDS[doc.type].toLowerCase()} ${doc.number}`;
  const body = `Hello ${c.name || c.company},\n\nPlease find ${lower} attached.\n\nThanks,\n${b.name}`;
  kit.toast('Remember to attach the PDF');
  location.href = `mailto:${encodeURIComponent(c.email).replace('%40', '@')}?subject=${encodeURIComponent(`${what}${b.name ? ` from ${b.name}` : ''}`)}&body=${encodeURIComponent(body)}`;
};
$('#to-contract').onclick = () => newDoc('contract', doc);
$('#to-invoice').onclick = () => newDoc('invoice', doc);
$('#dup').onclick = () => {
  const d = { ...structuredClone(doc), id: newId(), number: Clients.nextNumber(data.docs, doc.type), status: 'draft', date: today(),
    sigMe: { ...doc.sigMe, date: '', img: '' }, sigClient: { ...doc.sigClient, date: '', img: '' }, plan: doc.plan.map((r) => ({ ...r, paid: false })) };
  data.docs.unshift(d);
  kit.store();
  location.hash = `#/doc/${d.id}`;
};
$('#del-doc').onclick = () => {
  if (!confirm(`Delete ${WORDS[doc.type].toLowerCase()} ${doc.number}? This can't be undone.`)) return;
  data.docs = data.docs.filter((d) => d !== doc);
  kit.store();
  location.hash = '#/';
};

// ---- Settings: your business
const settings = $('#app-settings');
const BIZ = ['name', 'email', 'phone', 'address', 'taxId', 'currency', 'tax', 'payNote'];
setOptions(settings.querySelector('[name=b-currency]'), Clients.CURRENCIES.map((c) => [c, c]));
function fillSettings() {
  for (const k of BIZ) settings.querySelector(`[name=b-${k}]`).value = data.business[k];
  const img = $('#logo-img');
  img.hidden = !data.business.logo;
  $('#logo-del').hidden = !data.business.logo;
  if (data.business.logo) img.src = data.business.logo; else img.removeAttribute('src');
}
settings.addEventListener('input', (e) => {
  const k = e.target.name?.replace('b-', '');
  if (!BIZ.includes(k)) return;
  data.business[k] = k === 'tax' ? clamp(numberOr0(e.target.value), 0, 100) : e.target.value;
  kit.store();
  redraw();
});
$('#logo-add').onclick = async () => {
  const file = await Unsubbed.pickFile('image/png,image/jpeg');
  if (!file) return;
  try {
    // Redrawn small: keeps storage light and drops any metadata in the original file.
    const bmp = await createImageBitmap(file), k = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
    const c = h('canvas', { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    data.business.logo = c.toDataURL('image/png');
    fillSettings(); kit.store(); redraw();
  } catch { kit.toast("Couldn't read that image"); }
};
$('#logo-del').onclick = () => { data.business.logo = ''; fillSettings(); kit.store(); redraw(); };
// Redraws what's on screen without rebuilding the form under the cursor.
function redraw() {
  if (doc) renderPaper(); else if (!$('#v-desk').hidden) renderDesk();
}

// ---- Start. Unreadable saved data shouldn't stop the app; the user is told instead of left guessing.
let unreadable = false;
try { JSON.parse(localStorage.getItem('unsubbed:clients') || 'null'); } catch {
  unreadable = true;
  localStorage.removeItem('unsubbed:clients');
}
const kit = Unsubbed.app({
  id: 'clients',
  name: 'Unsubbed Clients',
  accept: '.json',
  load(s) { try { data = Clients.clean(s); } catch { unreadable = true; data = blank(); } },
  state: () => data,
  exportFile: () => ({ name: 'unsubbed-clients.json', data: JSON.stringify(data, null, 2), type: 'application/json' }),
  async importFile(file) {
    const next = Clients.clean(JSON.parse(await file.text()));
    if ((data.docs.length || data.clients.length) && !confirm('Replace everything here with this file? Save a copy first if unsure.')) throw new Error('Cancelled');
    data = next;
    client = returnDoc = null;
    fillSettings();
    location.hash = '#/';
    route();
  },
});
fillSettings();
route();
if (unreadable) kit.toast("Your saved data couldn't be read. Open a saved copy to restore it.");
