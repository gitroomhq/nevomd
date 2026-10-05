/**
 * Postiz MRR, from TrustMRR, into src/data/mrr.json: the one file the headline, the Proof
 * card and the chart read. `pnpm build` runs it first; `pnpm mrr` runs it alone.
 *
 * TrustMRR (trustmrr.com/docs/api) reads Postiz's Stripe and gives today's MRR only, no
 * history, so the month-start points already in the file stay and today's figure is added
 * as the latest point. Its figure runs a little under Stripe's own MRR, so it is scaled by
 * ADJUST. TRUSTMRR_API_KEY goes in .env locally and in a variable on Railway.
 *
 * No key: the file stays as it is, so a build without one still works.
 * Key set and TrustMRR fails: the script fails, so the build fails and Railway keeps serving
 * the last good deploy rather than an older number.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/data/mrr.json', import.meta.url);
const KEY = process.env.TRUSTMRR_API_KEY;
const API = 'https://trustmrr.com/api/v1/startups/postiz';
/** TrustMRR's MRR × this ≈ the MRR on Stripe's Billing dashboard. */
const ADJUST = 1.0206;

const isoDate = (t) => new Date(t).toISOString().slice(0, 10);
const usd = (n) => `$${n.toLocaleString('en-US')}`;

const file = JSON.parse(readFileSync(FILE, 'utf8'));
const prev = file.points[file.points.length - 1];

if (!KEY) {
  console.log(`trustmrr-mrr: no TRUSTMRR_API_KEY, keeping src/data/mrr.json (${usd(prev.mrr)} on ${prev.date}).`);
  process.exit(0);
}

const HINTS = {
  401: 'Check TRUSTMRR_API_KEY.',
  403: 'TrustMRR has turned API access off for this key.',
  429: 'Rate limited: 10 requests a minute on a standard key.',
};

let reported;
try {
  const res = await fetch(API, {
    headers: { Authorization: `Bearer ${KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`TrustMRR answered ${res.status}: ${body.error ?? res.statusText} ${HINTS[res.status] ?? ''}`);
  // The docs say cents, but the API sends dollars (239157.67 on 5 Oct 2026, against $229,846 on Stripe on 30 Sep).
  reported = body.data?.revenue?.mrr;
  if (!Number.isFinite(reported) || reported <= 0) throw new Error(`Unexpected answer: ${JSON.stringify(body.data?.revenue)}`);
} catch (err) {
  console.error(`trustmrr-mrr: ${err.message}`);
  process.exit(1);
}

const mrr = Math.round(reported * ADJUST);
// Guards against a unit change (cents again) or the wrong startup.
if (mrr < prev.mrr / 2 || mrr > prev.mrr * 2) {
  console.error(`trustmrr-mrr: ${usd(mrr)} is too far from the last figure, ${usd(prev.mrr)} on ${prev.date}. Did the units change?`);
  process.exit(1);
}

// The chart's points: the first day of each month, the last reading of each past month, then today.
const today = isoDate(Date.now());
const points = file.points.filter((p) => p.date < today && (p.date.endsWith('-01') || p.date.slice(0, 7) !== today.slice(0, 7)));
points.push({ date: today, mrr });

const out = {
  source: 'Month starts up to Sep 2026 read off the Stripe MRR chart (reference/stripe-mrr-2026-09-30.png); later figures from the TrustMRR API',
  adjust: ADJUST,
  note: `Written by scripts/trustmrr-mrr.mjs on every build: TrustMRR's MRR × ${ADJUST}, added as the latest point. Earlier points are kept.`,
  points,
};
writeFileSync(FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(`trustmrr-mrr: ${usd(mrr)} MRR on ${today} (TrustMRR ${usd(Math.round(reported))} × ${ADJUST}).`);
