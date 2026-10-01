/**
 * Chart maths for the Stripe-style cards. Runs at build time only:
 * the page ships finished SVG paths, not a chart library.
 */
import data from '../data/mrr.json';

export type Point = { date: string; t: number; mrr: number };

const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export const series: Point[] = data.points.map((p) => ({ date: p.date, t: toTime(p.date), mrr: p.mrr }));

/** MRR at any date inside the series, interpolated between the two nearest points. */
export function valueAt(iso: string): number {
  const t = toTime(iso);
  if (t <= series[0].t) return series[0].mrr;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    if (t <= b.t) return a.mrr + ((t - a.t) / (b.t - a.t)) * (b.mrr - a.mrr);
  }
  return series[series.length - 1].mrr;
}

/** The points between two dates, with both ends included even if they fall between points. */
export function slice(fromIso: string, toIso: string): Point[] {
  const t0 = Math.max(toTime(fromIso), series[0].t);
  const t1 = Math.min(toTime(toIso), series[series.length - 1].t);
  const inner = series.filter((p) => p.t > t0 && p.t < t1);
  const edge = (t: number): Point => {
    const iso = new Date(t).toISOString().slice(0, 10);
    return { date: iso, t, mrr: valueAt(iso) };
  };
  return [edge(t0), ...inner, edge(t1)];
}

export type Box = { x0: number; x1: number; y0: number; y1: number };

export function scales(box: Box, tDomain: [number, number], yMax: number) {
  const x = (t: number) => box.x0 + ((t - tDomain[0]) / (tDomain[1] - tDomain[0])) * (box.x1 - box.x0);
  const y = (v: number) => box.y1 - (v / yMax) * (box.y1 - box.y0);
  return { x, y };
}

export function linePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export function areaPath(points: { x: number; y: number }[], baseline: number): string {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${last.x.toFixed(1)} ${baseline.toFixed(1)} L${first.x.toFixed(1)} ${baseline.toFixed(1)} Z`;
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export const usdCompact = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);

export const monthYear = (t: number) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export const fullDate = (t: number) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
