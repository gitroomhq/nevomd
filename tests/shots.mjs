/**
 * Screenshots of the page at the moments that matter, for reviewing the look by eye.
 *
 *   node tests/shots.mjs [outDir] [--mobile] [--url=http://localhost:4321]
 *
 * Uses the installed Google Chrome, so no browser download is needed.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) ?? 'test-results/shots';
const mobile = args.includes('--mobile');
const url = (args.find((a) => a.startsWith('--url=')) ?? '--url=http://localhost:4321').slice(6);
const only = (args.find((a) => a.startsWith('--only=')) ?? '--only=').slice(7);
const [sizeW, sizeH] = (args.find((a) => a.startsWith('--size=')) ?? '--size=1440x900').slice(7).split('x').map(Number);

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 780 } : { width: sizeW, height: sizeH },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
const page = await context.newPage();
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[browser ${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[page error]', e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const top = (el) => Math.round(el.getBoundingClientRect().top + scrollY);
  const chapters = [...document.querySelectorAll('[data-chapter]')].map((el) => ({ kind: el.dataset.chapter, top: top(el), height: el.offsetHeight }));
  const sections = ['proof', 'how', 'faq'].map((id) => ({ id, top: top(document.getElementById(id)) }));
  return {
    vh: innerHeight,
    docHeight: document.documentElement.scrollHeight,
    chapters,
    sections,
    live: !!document.querySelector('.story.is-live'),
    // Where the finale's two halves start and end, from the stage itself (dev server only).
    marks: window.__stage?.marks?.(),
  };
});
console.log(JSON.stringify(info));

const vh = info.vh;
const abilities = info.chapters.filter((c) => c.kind === 'ability');

/** name → scrollY */
const stops = [['00-hero', 0]];
// Leaving the hero: the brain shrinks and travels to the side.
[0.25, 0.5, 0.75].forEach((f, i) => stops.push([`0${i + 1}-travel-${Math.round(f * 100)}`, (abilities[0].top - vh * 0.72) * f]));
abilities.forEach((c, i) => {
  stops.push([`1${i}-ability-${i + 1}-building`, c.top - vh * 0.62]);
  stops.push([`1${i}-ability-${i + 1}`, c.top - vh * 0.22]);
});
// The finale: the brain gathers in the middle, then Nevo comes up to it.
if (info.marks) {
  const { gatherFrom, gatherTo, landingFrom, landingPlayed, landingTo } = info.marks;
  [0.3, 0.7, 1].forEach((f, i) => stops.push([`2${i}-gather-${Math.round(f * 100)}`, gatherFrom + (gatherTo - gatherFrom) * f]));
  // Fractions of the landing's animation, which plays out before the page has finished
  // bringing Nevo up; then where the page has brought him, and a little after.
  [0.2, 0.4, 0.52, 0.64, 0.76, 0.8, 0.875, 0.905, 1].forEach((f, i) =>
    stops.push([`2${String.fromCharCode(97 + i)}-landing-${Math.round(f * 1000) / 10}`, landingFrom + (landingPlayed - landingFrom) * f]),
  );
  stops.push(['2x-rest', landingTo]);
  stops.push(['2y-after', landingTo + vh * 0.2]);
  stops.push(['2z-after', landingTo + vh * 0.45]);
}
info.sections.forEach((s, i) => stops.push([`3${i}-${s.id}`, s.top]));
stops.push(['40-end', info.docHeight]);

for (const [name, y] of stops) {
  if (only && !name.includes(only)) continue;
  await page.evaluate((v) => window.scrollTo(0, v), Math.max(0, Math.round(y)));
  await page.waitForTimeout(700); // let eased values settle
  await page.screenshot({ path: join(outDir, `${name}${mobile ? '-m' : ''}.png`) });
}

// The full install panel in "How it works" (the only place with the MCP server), MCP tab open.
if (!only || 'install'.includes(only)) {
  await page.evaluate(() => document.querySelector('#how').scrollIntoView());
  await page.waitForTimeout(300);
  await page.click('#how .install [data-tab="mcp"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `50-install-mcp${mobile ? '-m' : ''}.png`) });
  await page.click('#how .install [data-agent="cursor"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `51-install-mcp-cursor${mobile ? '-m' : ''}.png`) });
}

await browser.close();
console.log('saved to', outDir);
