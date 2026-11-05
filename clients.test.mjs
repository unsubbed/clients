// Run with: node apps/clients/clients.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const C = createRequire(import.meta.url)('./clients.js');
const test = (name, fn) => { fn(); console.log('ok  ' + name); };
const T = '2026-11-04';
const inv = (o) => ({ type: 'invoice', status: 'sent', currency: 'USD', date: T, items: [{ desc: 'x', qty: 1, price: 10000 }], ...o });

test('toCents handles float edges and junk', () => {
  assert.equal(C.toCents('19.99'), 1999);
  assert.equal(C.toCents(1.005), 101);
  assert.equal(C.toCents('abc'), 0);
  assert.equal(C.toCents(''), 0);
});

test('totals: fractional quantity, discount, then tax on the discounted amount', () => {
  const t = C.totals({ items: [{ qty: 1.5, price: 10000 }, { qty: 2, price: 2550 }], discount: 10, tax: 8.25 });
  assert.deepEqual(t, { sub: 20100, discount: 2010, tax: 1492, total: 19582 });
  assert.equal(C.totals({}).total, 0);
});

test('payment plan rows add up exactly to the total', () => {
  const a = C.planAmounts(10000, [{ pct: 33 }, { pct: 33 }, { pct: 34 }]);
  assert.deepEqual(a, [3300, 3300, 3400]);
  const b = C.planAmounts(10001, [{ pct: 50 }, { pct: 50 }]);
  assert.equal(b[0] + b[1], 10001);
  const c = C.planAmounts(1, [{ pct: 33.3 }, { pct: 33.3 }, { pct: 33.4 }]);
  assert.equal(c.reduce((x, y) => x + y), 1);
});

test('float noise in percents still counts as 100', () => {
  assert.equal(C.planPercent([{ pct: 0.1 }, { pct: 0.2 }, { pct: 99.7 }]), 100);
  const a = C.planAmounts(1001, [{ pct: 0.1 }, { pct: 0.2 }, { pct: 99.7 }]);
  assert.equal(a.reduce((x, y) => x + y), 1001);
});

test('plan not adding to 100 keeps plain percentages', () => {
  assert.deepEqual(C.planAmounts(10000, [{ pct: 50 }, { pct: 20 }]), [5000, 2000]);
  assert.equal(C.planPercent([{ pct: 50 }, { pct: 20 }]), 70);
});

test('invoice states: draft owes nothing overdue, sent, overdue, paid', () => {
  assert.equal(C.invoiceState(inv({ status: 'draft', due: '2020-01-01' }), T).overdue, 0);
  assert.equal(C.invoiceState(inv({ due: '2026-11-04' }), T).label, 'Sent'); // due today is not late
  const late = C.invoiceState(inv({ due: '2026-11-03' }), T);
  assert.equal(late.label, 'Overdue');
  assert.equal(late.overdue, 10000);
  assert.equal(C.invoiceState(inv({ plan: [{ pct: 100, paid: true }] }), T).label, 'Paid'); // every part paid
  const paid = C.invoiceState(inv({ status: 'paid', due: '2026-01-01' }), T);
  assert.deepEqual([paid.label, paid.balance, paid.overdue], ['Paid', 0, 0]);
});

test('payment plan: part paid and late rows', () => {
  const plan = [{ pct: 50, paid: true, due: '2026-10-01' }, { pct: 50, paid: false, due: '2026-12-01' }];
  const s = C.invoiceState(inv({ plan }), T);
  assert.deepEqual([s.label, s.paid, s.balance, s.overdue], ['Part paid', 5000, 5000, 0]);
  const late = C.invoiceState(inv({ plan: [plan[0], { ...plan[1], due: '2026-11-01' }] }), T);
  assert.deepEqual([late.label, late.overdue], ['Overdue', 5000]);
});

test('summary keeps currencies apart and skips drafts and other types', () => {
  const s = C.summary([
    inv({ due: '2026-01-01' }),
    inv({ currency: 'EUR', status: 'paid' }),
    inv({ status: 'draft' }),
    inv({ status: 'paid', date: '2025-06-01' }),
    { type: 'proposal', status: 'sent', currency: 'USD', items: [{ qty: 1, price: 999 }] },
  ], T);
  assert.deepEqual(s.USD, { unpaid: 10000, overdue: 10000, paidYear: 0 });
  assert.deepEqual(s.EUR, { unpaid: 0, overdue: 0, paidYear: 10000 });
});

test('nextNumber goes one above the highest, per type, ignoring custom numbers', () => {
  const docs = [{ type: 'invoice', number: 'INV-0007' }, { type: 'invoice', number: 'custom' }, { type: 'proposal', number: 'INV-0099' }];
  assert.equal(C.nextNumber(docs, 'invoice'), 'INV-0008');
  assert.equal(C.nextNumber(docs, 'contract'), 'CON-0001');
});

test('fill replaces known blanks and leaves unknown ones visible', () => {
  assert.equal(C.fill('{{client}} owes {{total}} {{nope}}', { client: 'A', total: '$1' }), 'A owes $1 {{nope}}');
  assert.equal(C.fill('{{constructor}}', {}), '{{constructor}}');
});

test('csv quotes and guards formulas', () => {
  assert.equal(C.csv([['a,b', 'c"d', '=SUM(1)', '\tx', '12.50']]), `"a,b","c""d",'=SUM(1),'\tx,12.50\r\n`);
});

test('okDate refuses impossible dates', () => {
  assert.ok(C.okDate('2024-02-29'));
  for (const d of ['2025-02-31', '2025-99-99', 'x', '', null]) assert.ok(!C.okDate(d));
});

test('clean rejects wrong files and strips hostile values', () => {
  assert.throws(() => C.clean({ days: {} }));
  assert.throws(() => C.clean(null));
  const out = C.clean({
    business: { name: 5, logo: 'javascript:alert(1)', currency: 'XXX', tax: 900 },
    clients: [{ id: 'a"]<x>', name: 'bad id' }, { id: 'c1', name: '<b>ok</b>' }, { id: 'c1', name: 'dupe' }],
    docs: [
      { id: 'd1', type: 'constructor' },
      { id: 'd3', type: ['invoice'] },
      { id: 'd2', type: 'invoice', status: 'hacked', date: '2025-99-99', items: [{ desc: 'x', qty: -1, price: 1e99 }, null], plan: [{ pct: 'x', paid: 'yes' }],
        sigMe: { img: 'data:image/svg+xml;base64,AAAA' }, sigClient: { img: 'data:image/png;base64,AAAA' } },
    ],
  });
  assert.equal(out.business.name, '');
  assert.equal(out.business.logo, '');
  assert.equal(out.business.currency, 'USD');
  assert.equal(out.business.tax, 0);
  assert.deepEqual(out.clients.map((c) => c.name), ['<b>ok</b>']);
  assert.equal(out.docs.length, 1);
  const d = out.docs[0];
  assert.deepEqual([d.status, d.date, d.items.length, d.items[0].qty, d.items[0].price], ['draft', '', 1, 0, 0]);
  assert.deepEqual(d.plan[0], { label: '', pct: 0, due: '', paid: false });
  assert.equal(d.sigMe.img, '');
  assert.equal(d.sigClient.img, 'data:image/png;base64,AAAA');
});

test('okEmail allows one plain address only', () => {
  assert.ok(C.okEmail('sam+work@juniper.example'));
  for (const e of ['', 'a@x.com,evil@y.com', 'a@x.com;evil@y.com', 'a b@x.com', 'a@x.com?cc=evil@y.com', 'nope']) assert.ok(!C.okEmail(e));
});

test('clean caps oversized files', () => {
  const out = C.clean({ clients: [], docs: [{ id: 'd', type: 'invoice', title: 'x'.repeat(200000), items: Array(9000).fill({ desc: 'x', qty: 1, price: 1 }),
    sigMe: { img: 'data:image/png;base64,' + 'A'.repeat(600000) } }] });
  assert.equal(out.docs[0].title.length, 100000);
  assert.equal(out.docs[0].items.length, 5000);
  assert.equal(out.docs[0].sigMe.img, '');
});

test('clean round-trips a good document unchanged', () => {
  const doc = { id: 'd', type: 'proposal', clientId: 'c', number: 'PRO-0001', title: 'T', date: T, status: 'accepted', currency: 'EUR',
    items: [{ desc: 'x', qty: 2, price: 500 }], discount: 5, tax: 20, notes: 'n', intro: 'i', validUntil: T, body: '', due: '', payNote: '', plan: [],
    sigMe: { name: 'A', date: T, img: '' }, sigClient: { name: '', date: '', img: '' } };
  assert.deepEqual(C.clean({ clients: [], docs: [doc] }).docs[0], doc);
});
