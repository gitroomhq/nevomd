/**
 * Nevo's scenes at the bottom of the ability sections (components/NevoAct.astro): each is a
 * video that the scroll plays. These check that where a scene is on the screen is where its
 * video is, both ways, that the mouse does nothing to it, and that it stays a still for someone
 * who asked for less motion.
 */
import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}

/** Where the scene's video is, from 0 (its first frame) to 1 (its last). */
const position = (page: Page, act: string) =>
  page.evaluate((act) => {
    const v = document.querySelector<HTMLVideoElement>(`[data-act="${act}"] video`)!;
    return v.currentTime / v.duration;
  }, act);

/**
 * The scroll positions at which the scene starts and ends: it starts with nearly all of the
 * picture on screen, and has played out when the picture is in the middle of the screen.
 */
async function span(page: Page, act: string) {
  return page.evaluate((act) => {
    const box = document.querySelector(`[data-act="${act}"]`)!.getBoundingClientRect();
    const bottom = box.bottom + window.scrollY;
    const view = window.innerHeight;
    return {
      // Its bottom a little below the bottom of the screen.
      start: Math.round(bottom - view - box.height * 0.15),
      // Its middle at the middle of the screen.
      end: Math.round(bottom - view / 2 - box.height / 2),
      view,
    };
  }, act);
}

const scrollTo = (page: Page, y: number) => page.evaluate((y) => window.scrollTo(0, y), y);

/** Brings a scene near and waits until its video can be played. */
async function load(page: Page, act: string) {
  const { start } = await span(page, act);
  await scrollTo(page, start);
  await page.waitForSelector(`[data-act="${act}"].is-live`, { timeout: 15_000 });
}

for (const act of ['scan', 'surf', 'coach', 'grow']) {
  test(`the scroll plays the ${act} scene, both ways`, async ({ page }) => {
    await ready(page);
    await load(page, act);
    const { start, end, view } = await span(page, act);
    // Quick, but not so quick it is missed: about a third of a screen of scrolling.
    expect(end - start).toBeGreaterThan(view * 0.3);
    expect(end - start).toBeLessThan(view * 0.45);

    await scrollTo(page, start - 80);
    await expect.poll(() => position(page, act), { timeout: 5000 }).toBeLessThan(0.03);

    await scrollTo(page, Math.round((start + end) / 2));
    await expect.poll(() => position(page, act), { timeout: 5000 }).toBeGreaterThan(0.4);
    await expect.poll(() => position(page, act), { timeout: 5000 }).toBeLessThan(0.6);

    await scrollTo(page, end + 80);
    await expect.poll(() => position(page, act), { timeout: 5000 }).toBeGreaterThan(0.97);

    // Played out, the picture is still whole on screen, and stays so a while longer.
    for (const y of [end, end + Math.round(view * 0.15)]) {
      await scrollTo(page, y);
      const box = await page.evaluate((act) => document.querySelector(`[data-act="${act}"]`)!.getBoundingClientRect().toJSON(), act);
      expect(box.top, `the top of the picture, at ${y}`).toBeGreaterThanOrEqual(0);
      expect(box.bottom, `the bottom of the picture, at ${y}`).toBeLessThanOrEqual(view);
    }

    // Back up: it runs backwards.
    await scrollTo(page, Math.round(start + (end - start) * 0.25));
    await expect.poll(() => position(page, act), { timeout: 5000 }).toBeGreaterThan(0.15);
    await expect.poll(() => position(page, act), { timeout: 5000 }).toBeLessThan(0.35);
  });
}

test('the mouse does nothing to a scene, and the page does not move', async ({ page }) => {
  await ready(page);
  await load(page, 'scan');
  const { start, end } = await span(page, 'scan');
  await scrollTo(page, Math.round((start + end) / 2));
  // Settled: it eases toward where the scroll says, so wait until it has stopped.
  let previous = -1;
  await expect
    .poll(
      async () => {
        const now = await position(page, 'scan');
        const still = now === previous;
        previous = now;
        return still;
      },
      { timeout: 5000, intervals: [200] },
    )
    .toBe(true);
  const before = await position(page, 'scan');

  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width * 0.05, viewport.height * 0.7, { steps: 4 });
  await page.mouse.move(viewport.width * 0.95, viewport.height * 0.2, { steps: 8 });
  await page.waitForTimeout(600);

  expect(await position(page, 'scan')).toBeCloseTo(before, 2);
  expect(await page.evaluate(() => window.scrollY)).toBe(Math.round((start + end) / 2));
});

test('with reduced motion, the scenes stay stills and load no video', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.evaluate(() => document.querySelector('[data-act="scan"]')!.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-act]')].map((el) => ({
      live: el.classList.contains('is-live'),
      src: el.querySelector('video')?.getAttribute('src') ?? null,
    })),
  );
  expect(state.length).toBe(4);
  expect(state.every((s) => !s.live && !s.src)).toBe(true);
});
