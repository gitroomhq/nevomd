/**
 * Postiz MRR, straight from Stripe, into src/data/mrr.json: the one file the headline, the
 * Proof card and the chart read. `pnpm build` runs it first; `pnpm mrr` runs it alone.
 *
 * It asks Stripe's Analytics API (docs.stripe.com/data/analytics) for `revenue.mrr`, Stripe's
 * own MRR, the number on the Billing dashboard. The API is in private preview: the account
 * has to be let in, and STRIPE_ANALYTICS_KEY has to be a restricted key with
 * Data > Metrics > Read and nothing else (in .env locally, a variable on Railway).
 *
 * No key: the file stays as it is, so a build without one still works.
 * Key set and Stripe fails: the script fails, so the build fails and Railway keeps serving
 * the last good deploy rather than an older number.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/data/mrr.json', import.meta.url);
const KEY = process.env.STRIPE_ANALYTICS_KEY;
const API = 'https://api.stripe.com/v2/data/analytics/metric_query';
const VERSION = '2026-04-22.preview';
/** The chart starts at the open-source launch. */
const START = '2024-09-01';
/** A daily query can span 92 days at most. */
const WINDOW = 90;
const DAY = 86_400_000;

const isoDate = (t) => new Date(t).toISOString().slice(0, 10);
const usd = (n) => `$${n.toLocaleString('en-US')}`;

if (!KEY) {
  const { points } = JSON.parse(readFileSync(FILE, 'utf8'));
  const last = points[points.length - 1];
  console.log(`stripe-mrr: no STRIPE_ANALYTICS_KEY, keeping src/data/mrr.json (${usd(last.mrr)} on ${last.date}).`);
  process.exit(0);
}

const HINTS = {
  401: 'Check STRIPE_ANALYTICS_KEY.',
  403: 'The key needs Data > Metrics > Read.',
  404: 'Has Stripe let the account into the Analytics API preview? docs.stripe.com/data/analytics',
};

/** MRR for each day in [from, to), in cents. Stripe sends a row for every day, 0 if empty. */
async function mrrByDay(from, to) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Stripe-Version': VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metrics: [{ name: 'revenue.mrr' }],
      starts_at: `${isoDate(from)}T00:00:00Z`,
      ends_at: `${isoDate(to)}T00:00:00Z`,
      granularity: 'day',
      currency: 'usd',
      timezone: 'UTC',
      limit: 1000,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code = '', message = res.statusText } = body.error ?? {};
    throw new Error(`Stripe answered ${res.status} ${code}: ${message} ${HINTS[res.status] ?? ''}`);
  }
  if (body.livemode === false) throw new Error('That is a sandbox key; the site needs live mode.');
  const days = (to - from) / DAY;
  if (body.data?.length !== days) {
    throw new Error(`Stripe sent ${body.data?.length} days for ${isoDate(from)} to ${isoDate(to)}, not ${days}.`);
  }
  return body;
}

const mrr = new Map();
let refreshedAt;
try {
  // Up to yesterday, the latest full day (UTC).
  const today = Date.parse(`${isoDate(Date.now())}T00:00:00Z`);
  for (let from = Date.parse(`${START}T00:00:00Z`); from < today; from += WINDOW * DAY) {
    const to = Math.min(from + WINDOW * DAY, today);
    const { data, refreshed_at } = await mrrByDay(from, to);
    for (const row of data) {
      const result = row.results?.find((r) => r.name === 'revenue.mrr');
      if (result?.currency?.toLowerCase() !== 'usd' || !Number.isFinite(result.value)) {
        throw new Error(`Unexpected row from Stripe: ${JSON.stringify(row)}`);
      }
      mrr.set(row.timestamp.slice(0, 10), Math.round(result.value / 100));
    }
    refreshedAt = refreshed_at;
  }
} catch (err) {
  console.error(`stripe-mrr: ${err.message}`);
  process.exit(1);
}

// The chart's points: the first day of each month, then the latest day.
const dates = [...mrr.keys()].sort();
const last = dates[dates.length - 1];
const points = dates.filter((d) => d.endsWith('-01') || d === last).map((date) => ({ date, mrr: mrr.get(date) }));
const latest = points[points.length - 1];
if (!latest.mrr) {
  console.error(`stripe-mrr: Stripe says MRR was $0 on ${last}. Is the key from the Postiz account?`);
  process.exit(1);
}

const out = {
  source: `Stripe Analytics API: revenue.mrr by day, UTC (Stripe-Version ${VERSION})`,
  exact: true,
  refreshed_at: refreshedAt,
  note: 'Written by scripts/stripe-mrr.mjs on every build: MRR on the first day of each month, then on the latest full day.',
  points,
};
writeFileSync(FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(`stripe-mrr: ${usd(latest.mrr)} MRR on ${last}, from Stripe (its data as of ${refreshedAt}).`);
