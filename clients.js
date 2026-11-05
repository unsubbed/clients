// Unsubbed Clients engine: money math and data cleaning. Pure functions, no DOM. Money is whole cents.
const Clients = (() => {
  const TYPES = { proposal: 'PRO', contract: 'CON', invoice: 'INV' };
  const STATUSES = {
    proposal: ['draft', 'sent', 'accepted', 'declined'],
    contract: ['draft', 'sent', 'signed'],
    invoice: ['draft', 'sent', 'paid'],
  };
  // Two-decimal currencies only, so cents math and display always agree.
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'INR', 'BDT', 'ZAR', 'SGD', 'CHF', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'PHP', 'NGN'];

  const toCents = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(+(n * 100).toFixed(6)) : 0;
  };

  function totals(doc) {
    const sub = (doc.items || []).reduce((s, i) => s + Math.round((i.qty || 0) * (i.price || 0)), 0);
    const discount = Math.round(sub * (doc.discount || 0) / 100);
    const tax = Math.round((sub - discount) * (doc.tax || 0) / 100);
    return { sub, discount, tax, total: sub - discount + tax };
  }

  // Rounded so 0.1 + 0.2 + 99.7 counts as exactly 100.
  const planPercent = (plan) => Math.round((plan || []).reduce((s, r) => s + (r.pct || 0), 0) * 1e6) / 1e6;

  // When percents make 100, the last row takes the rounding remainder so rows add up exactly.
  function planAmounts(total, plan) {
    const out = (plan || []).map((r) => Math.round(total * (r.pct || 0) / 100));
    if (out.length && planPercent(plan) === 100) out[out.length - 1] = total - out.slice(0, -1).reduce((a, b) => a + b, 0);
    return out;
  }

  function invoiceState(doc, today) {
    const total = totals(doc).total, plan = doc.plan || [];
    if (doc.status === 'draft') return { total, paid: 0, balance: total, overdue: 0, label: 'Draft' };
    const amounts = planAmounts(total, plan);
    const paid = doc.status === 'paid' ? total : Math.min(total, plan.reduce((s, r, i) => s + (r.paid ? amounts[i] : 0), 0));
    const balance = total - paid;
    const late = plan.length
      ? plan.reduce((s, r, i) => s + (!r.paid && r.due && r.due < today ? amounts[i] : 0), 0)
      : (doc.due && doc.due < today ? balance : 0);
    const overdue = Math.min(late, balance);
    const label = doc.status === 'paid' || (total > 0 && balance === 0) ? 'Paid' : overdue > 0 ? 'Overdue' : paid > 0 ? 'Part paid' : 'Sent';
    return { total, paid, balance, overdue, label };
  }

  // Per currency, because adding dollars to euros would be a wrong number.
  function summary(docs, today) {
    const out = {};
    for (const d of docs) {
      if (d.type !== 'invoice' || d.status === 'draft') continue;
      const s = invoiceState(d, today), c = (out[d.currency] ||= { unpaid: 0, overdue: 0, paidYear: 0 });
      c.unpaid += s.balance;
      c.overdue += s.overdue;
      if ((d.date || '').slice(0, 4) === today.slice(0, 4)) c.paidYear += s.paid;
    }
    return out;
  }

  function nextNumber(docs, type) {
    const prefix = TYPES[type];
    let max = 0;
    for (const d of docs) {
      const m = d.type === type && new RegExp(`^${prefix}-(\\d+)$`).exec(d.number || '');
      if (m) max = Math.max(max, +m[1]);
    }
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  const fill = (text, values) => String(text).replace(/\{\{(\w+)\}\}/g, (m, k) => (Object.hasOwn(values, k) ? values[k] : m));

  // RFC 4180, plus a guard so a spreadsheet never runs a cell as a formula.
  function csv(rows) {
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
  // A real calendar date: rejects 2025-02-31, which Date would quietly roll over.
  const okDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && addDays(d, 0) === d;

  // Trust boundary: everything from storage or an opened file passes through here.
  // Caps sit far above real use (storage holds about 5 MB) and stop a crafted file freezing the page.
  const MAX_TEXT = 100000, MAX_ROWS = 5000, MAX_IMAGE = 500000;
  const str = (v) => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '');
  const date = (v) => (okDate(v) ? v : '');
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : 0);
  const png = (v) => (typeof v === 'string' && v.length <= MAX_IMAGE && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) ? v : '');
  const okId = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
  const list = (v) => (Array.isArray(v) ? v.slice(0, MAX_ROWS).filter((x) => x && typeof x === 'object') : []);
  // One plain address: a comma or semicolon would add recipients to an email draft.
  const okEmail = (v) => /^[^\s,;<>"?&]+@[^\s,;<>"?&]+$/.test(v);
  const uniqueIds = (rows) => {
    const seen = new Set();
    return rows.filter((r) => okId(r.id) && !seen.has(r.id) && seen.add(r.id));
  };
  const currency = (v) => (CURRENCIES.includes(v) ? v : 'USD');
  const signature = (s) => ({ name: str(s?.name), date: date(s?.date), img: png(s?.img) });

  function clean(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.docs) || !Array.isArray(s.clients)) throw new Error('Not an Unsubbed Clients file');
    const b = s.business && typeof s.business === 'object' ? s.business : {};
    return {
      app: 'unsubbed-clients',
      version: 1,
      business: {
        name: str(b.name), email: str(b.email), phone: str(b.phone), address: str(b.address), taxId: str(b.taxId),
        logo: png(b.logo), currency: currency(b.currency), tax: num(b.tax, 0, 100), payNote: str(b.payNote),
      },
      clients: uniqueIds(list(s.clients)).map((c) => ({
        id: c.id, name: str(c.name), company: str(c.company), email: str(c.email), phone: str(c.phone), address: str(c.address), notes: str(c.notes),
      })),
      docs: uniqueIds(list(s.docs)).filter((d) => typeof d.type === 'string' && Object.hasOwn(TYPES, d.type)).map((d) => ({
        id: d.id,
        type: d.type,
        clientId: okId(d.clientId) ? d.clientId : '',
        number: str(d.number),
        title: str(d.title),
        date: date(d.date),
        status: STATUSES[d.type].includes(d.status) ? d.status : 'draft',
        currency: currency(d.currency),
        items: list(d.items).map((i) => ({ desc: str(i.desc), qty: num(i.qty, 0, 1e6), price: Math.round(num(i.price, 0, 1e11)) })),
        discount: num(d.discount, 0, 100),
        tax: num(d.tax, 0, 100),
        notes: str(d.notes),
        intro: str(d.intro),
        validUntil: date(d.validUntil),
        body: str(d.body),
        due: date(d.due),
        payNote: str(d.payNote),
        plan: list(d.plan).map((r) => ({ label: str(r.label), pct: num(r.pct, 0, 100), due: date(r.due), paid: r.paid === true })),
        sigMe: signature(d.sigMe),
        sigClient: signature(d.sigClient),
      })),
    };
  }

  return { TYPES, STATUSES, CURRENCIES, toCents, totals, planPercent, planAmounts, invoiceState, summary, nextNumber, fill, csv, addDays, okDate, okEmail, clean };
})();
if (typeof module !== 'undefined') module.exports = Clients;
