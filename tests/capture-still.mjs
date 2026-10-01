/**
 * Renders the still image of the brain: what shows before the 3D canvas is ready, and what
 * stays if WebGL is unavailable. It is one frame from the real renderer, at the angle the
 * canvas starts from, so the hand-over is invisible.
 *
 *   pnpm dev            (in another terminal)
 *   node tests/capture-still.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const out = new URL('../src/assets/art/brain-still.png', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2] ?? 'http://localhost:4321', { waitUntil: 'networkidle' });
await page.waitForFunction(() => '__hero' in window, null, { timeout: 15000 });
// Drawn with the same ink weight, relative to its size, as the hero's live canvas.
const dataUrl = await page.evaluate(() => window.__hero.snapshot(1024));
writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out.pathname);
