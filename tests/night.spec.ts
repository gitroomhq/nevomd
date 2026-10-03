/**
 * The last section (components/FinalCta.astro, scripts/night.ts): "Nevo's brain never sleeps".
 * Nevo lies awake with the lamp on; scroll down to the end and he falls asleep and the lights go
 * off, and the page goes dark with the room, as at the end of lemonade.com/life; scroll back up
 * and he wakes and the page is light again. All one movie, in clips played one after another.
 * The page ends with the room: there is no footer.
 *
 * Scrolled with the wheel, as a person does: the cases that went wrong were the ones where you
 * scroll on past the room, or back up in one flick.
 */
import { test, expect, type Page } from '@playwright/test';

type NightHook = { state: () => { shown: string | null; dark: number; target: string; movie: boolean } };

async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const view = page.viewportSize()!;
  await page.mouse.move(view.width / 2, view.height / 2);
}

const night = (page: Page) => page.evaluate(() => (window as unknown as { __night: NightHook }).__night.state());
const isDark = (page: Page) => page.evaluate(() => document.querySelector('[data-night]')!.classList.contains('is-dark'));
/** How dark the rest of the page above the room is: the dark layer over it (global.css). */
const pageDark = (page: Page) => page.evaluate(() => Number(getComputedStyle(document.querySelector('main')!, '::after').opacity));
const background = (page: Page, sel: string) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor, sel);

/** Scrolls with the wheel, a notch at a time, by about `by` pixels (down if positive). */
async function wheel(page: Page, by: number, notch = 120) {
  for (let done = 0; done < Math.abs(by); done += notch) {
    await page.mouse.wheel(0, Math.sign(by) * Math.min(notch, Math.abs(by) - done));
    await page.waitForTimeout(40);
  }
}

/** Down to the very bottom of the page with the wheel, and waits until he is asleep. */
async function toTheBottom(page: Page) {
  const end = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  await page.evaluate((y) => window.scrollTo(0, y), end - 2000);
  await wheel(page, 2200, 240);
  await expect.poll(async () => (await night(page)).dark, { timeout: 10_000 }).toBe(1);
}

test('the last section says the brain never sleeps', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-night] h2')).toHaveText('Nevo’s brain never sleeps');
  // The install block is still there to take away.
  await expect(page.locator('[data-night] [data-install]')).toHaveCount(1);
});

test('down to the end he falls asleep quickly; back up a little he wakes; down again, asleep', async ({ page }) => {
  await ready(page);
  // Above the room he is awake.
  await page.evaluate(() => document.querySelector('[data-night-room]')!.scrollIntoView({ block: 'end' }));
  await wheel(page, -360);
  await expect.poll(async () => (await night(page)).shown, { timeout: 15_000 }).toBe('awake');

  // Down to the end: the clips follow one another, and the lights are off within 3.5 s.
  const seen = new Set<string>();
  const t0 = Date.now();
  await wheel(page, 2000, 240);
  await expect
    .poll(
      async () => {
        const s = await night(page);
        if (s.shown) seen.add(s.shown);
        return s.dark;
      },
      { timeout: 10_000, intervals: [50] },
    )
    .toBe(1);
  expect(Date.now() - t0).toBeLessThan(3500);
  expect([...seen]).toContain('sleep');
  await expect.poll(async () => (await night(page)).shown, { timeout: 10_000 }).toBe('night');
  // The page went dark with the room, down to its end: the section is the page's dark, so is
  // the whole page above it, and there is nothing after the room.
  expect(await background(page, '[data-night]')).toBe('rgb(32, 32, 32)');
  expect(await page.evaluate(() => document.querySelector('footer'))).toBeNull();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - (document.querySelector('[data-night-room]')!.getBoundingClientRect().bottom + window.scrollY)),
  ).toBeLessThan(2);
  expect(await pageDark(page)).toBe(1);

  // A small jiggle does not wake him.
  await wheel(page, -48, 48);
  await page.waitForTimeout(150);
  await wheel(page, 48, 48);
  await page.waitForTimeout(300);
  expect(await isDark(page)).toBe(true);

  // Back up a little: he wakes, with the room on screen, and the page is light again at once.
  await wheel(page, -160, 80);
  await expect.poll(() => isDark(page), { timeout: 1000 }).toBe(false);
  await expect.poll(async () => (await night(page)).shown, { timeout: 1500, intervals: [30] }).toBe('wake');
  await expect.poll(async () => (await night(page)).dark, { timeout: 1500 }).toBe(0);
  expect(await pageDark(page)).toBe(0);
  await expect.poll(async () => (await night(page)).shown, { timeout: 10_000 }).toBe('awake');

  // Down again: asleep again.
  await wheel(page, 400, 200);
  await expect.poll(async () => (await night(page)).dark, { timeout: 10_000 }).toBe(1);
});

test('one flick back up from the bottom leaves the page light, and him awake when you come back', async ({ page }) => {
  await ready(page);
  await toTheBottom(page);
  await page.mouse.wheel(0, -3000);
  await expect.poll(async () => (await night(page)).dark, { timeout: 800 }).toBe(0);
  expect(await isDark(page)).toBe(false);
  expect(await background(page, '[data-night]')).toBe('rgb(255, 255, 255)');
  await expect.poll(() => pageDark(page), { timeout: 800 }).toBe(0);
  // Back down to the room, not to the end: he is awake.
  await page.evaluate(() => document.querySelector('[data-night-room]')!.scrollIntoView({ block: 'end' }));
  await wheel(page, -360);
  await expect.poll(async () => (await night(page)).shown, { timeout: 5000 }).toBe('awake');
  expect((await night(page)).dark).toBe(0);
});

test('on a phone it ends dark too, and he wakes on the way back up', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await ready(page);
  await toTheBottom(page);
  expect(await isDark(page)).toBe(true);
  // Back up a little (the room is short on a phone, so not so far that it leaves the screen):
  // he wakes, and the page is light again.
  await wheel(page, -120, 60);
  await expect.poll(async () => (await night(page)).shown, { timeout: 1500, intervals: [30] }).toBe('wake');
  await expect.poll(async () => (await night(page)).dark, { timeout: 1500 }).toBe(0);
  // On up, past the room: light, and nothing left half-way.
  await wheel(page, -600, 120);
  await expect.poll(async () => (await night(page)).dark, { timeout: 800 }).toBe(0);
  await expect.poll(() => pageDark(page), { timeout: 800 }).toBe(0);
});

test('changing your mind half-way turns the movie round at the same frame', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => document.querySelector('[data-night-room]')!.scrollIntoView({ block: 'end' }));
  await wheel(page, -360);
  await expect.poll(async () => (await night(page)).shown, { timeout: 15_000 }).toBe('awake');
  await wheel(page, 2000, 240);
  await expect.poll(async () => (await night(page)).shown, { timeout: 5000, intervals: [30] }).toBe('sleep');
  // Back up while he is falling asleep...
  await wheel(page, -240, 120);
  await expect.poll(async () => (await night(page)).shown, { timeout: 2000, intervals: [30] }).toBe('wake');
  // ...and he wakes, back to the lit room.
  await expect.poll(async () => (await night(page)).shown, { timeout: 15_000 }).toBe('awake');
  expect((await night(page)).dark).toBe(0);
});

test('with reduced motion the lights still go off and on, but there is no movie: two stills', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await toTheBottom(page);
  await wheel(page, -240, 120);
  await expect.poll(async () => (await night(page)).dark, { timeout: 1000 }).toBe(0);
  const srcs = await page.evaluate(() => [...document.querySelectorAll('[data-night-room] video')].map((v) => v.getAttribute('src')));
  expect(srcs.every((s) => s === null)).toBe(true);
});
