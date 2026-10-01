/**
 * The brain in the hero can be picked up with a mouse (brain/hero.ts): dragged sideways it
 * turns, dragged up or down it tips, and let go it sits back up. Dragging it never scrolls the
 * page. On a touch screen it cannot be picked up at all: a swipe over it scrolls the page.
 */
import { test, expect, type Page } from '@playwright/test';

type HeroHook = { pose: () => { spun: number; tip: number; held: boolean } };

const pose = (page: Page) => page.evaluate(() => (window as unknown as { __hero: HeroHook }).__hero.pose());

async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-hero-brain].is-live');
}

/** The middle of the brain's drawing square, in the window. */
async function middle(page: Page) {
  const box = (await page.locator('[data-hero-brain] canvas').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, size: box.width };
}

test('dragging the brain turns it and tips it, and it sits back up when let go', async ({ page }) => {
  await ready(page);
  const scrolled = await page.evaluate(() => window.scrollY);
  const { x, y, size } = await middle(page);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + size * 0.4, y, { steps: 10 });
  const across = await pose(page);
  expect(across.held).toBe(true);
  // A drag to the right turns its front to the right: a third of a turn for 40% of the square.
  expect(across.spun).toBeGreaterThan(0.25);
  expect(Math.abs(across.tip)).toBeLessThan(0.01);

  await page.mouse.move(x + size * 0.4, y + size * 0.15, { steps: 6 });
  const down = await pose(page);
  expect(down.tip).toBeGreaterThan(0.2);
  // Held still, it stays where the hand put it.
  await page.waitForTimeout(400);
  expect((await pose(page)).spun).toBeCloseTo(down.spun, 3);

  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await pose(page)).tip), { timeout: 4000 }).toBeLessThan(0.01);
  expect((await pose(page)).held).toBe(false);

  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test('a flick keeps the brain spinning for a moment', async ({ page }) => {
  await ready(page);
  const { x, y, size } = await middle(page);
  await page.mouse.move(x - size * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(x + size * 0.2, y, { steps: 4 });
  await page.mouse.up();
  const released = (await pose(page)).spun;
  await page.waitForTimeout(500);
  // It went on turning after the hand let go, the same way.
  expect((await pose(page)).spun).toBeGreaterThan(released + 0.05);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('a swipe over the brain scrolls the page and never turns it', async ({ page }) => {
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    const { x, y } = await middle(page);

    /** A finger on the middle of the brain, moved by (dx, dy) over 10 steps, then lifted. */
    const swipe = async (dx: number, dy: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    const scrollY = () => page.evaluate(() => window.scrollY);

    // Sideways: the brain is not picked up.
    await swipe(140, 0);
    expect(await pose(page)).toMatchObject({ spun: 0, held: false });

    // Up, and up and to one side: the page scrolls, as it does anywhere else.
    let before = await scrollY();
    await swipe(0, -220);
    expect(await scrollY()).toBeGreaterThan(before + 80);
    before = await scrollY();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await swipe(120, -200);
    expect(await scrollY()).toBeGreaterThan(60);
    expect(await pose(page)).toMatchObject({ spun: 0, held: false });

    // The browser handles every touch on it: nothing on the brain overrides that.
    expect(await page.locator('[data-hero-brain] canvas').evaluate((c) => getComputedStyle(c).touchAction)).toBe('auto');
  });
});
