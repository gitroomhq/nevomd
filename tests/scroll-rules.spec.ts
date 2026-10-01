/**
 * The scroll rules from PLAN.md 6.1, as tests. The brain story is scroll-linked, and these
 * make sure it stays that way without ever touching how the page scrolls:
 * no changed speed, no pinned sections, no scrolling that doesn't move the page.
 */
import { test, expect, type Page } from '@playwright/test';

type StageHook = {
  marks: () => { gatherFrom: number; gatherTo: number; landingFrom: number; landingTo: number };
  state: () => Record<string, number>;
  settled: () => boolean;
};

/**
 * Waits until the stage has caught up with the scroll position: its eased time has reached
 * the target, and nothing it sets is still changing.
 */
async function settle(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __stage: StageHook }).__stage.settled()), { timeout: 8000, intervals: [100] })
    .toBe(true);
  let previous = '';
  await expect
    .poll(
      async () => {
        const now = await signature(page);
        const stable = now === previous;
        previous = now;
        return stable;
      },
      { timeout: 6000, intervals: [250] },
    )
    .toBe(true);
}

async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('[data-hero-brain].is-live');
}


/**
 * A snapshot of everything the scroll story sets, to compare states: the values the timeline
 * writes (transforms, opacity, the scene's numbers), rounded. It deliberately reads those
 * rather than where things are on screen, because Nevo also breathes, blinks and looks about
 * on a timer.
 */
const signature = (page: Page) =>
  page.evaluate(() => {
    const round = (text: string) => text.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
    const read = (sel: string) =>
      [...document.querySelectorAll<HTMLElement | SVGElement>(sel)].map((el) =>
        round([el.style.transform, el.getAttribute('transform') ?? '', el.style.opacity, el.style.strokeDashoffset].join('|')),
      );
    const scene = document.querySelector<HTMLElement>('[data-scene]')!;
    const state = (window as unknown as { __stage: StageHook }).__stage.state();
    return JSON.stringify({
      scene: round(['--hero', '--final', '--rise'].map((v) => scene.style.getPropertyValue(v)).join('|')),
      numbers: Object.values(state).map((v) => Math.round(v * 100) / 100),
      brain: read('[data-brain]'),
      nodes: read('[data-node]'),
      links: read('[data-link], [data-ring]'),
      bust: read('[data-bust]'),
      head: read('[data-head], [data-face], [data-bust-nose]'),
      lid: read('[data-lid]'),
      face: read('[data-bust-eye], [data-bust-brow], [data-bust-mouth], [data-bust-oh]'),
      callout: read('[data-callout]'),
    });
  });

test('the wheel scrolls exactly as far as it is turned', async ({ page }) => {
  await ready(page);
  await page.mouse.move(400, 500);
  for (const delta of [300, 700, 1200]) {
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, delta);
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(before + delta);
  }
});

test('nothing listens to the wheel, and touch listeners are passive', async ({ page }) => {
  await page.addInitScript(() => {
    const log: { type: string; passive: boolean; from: string }[] = [];
    (window as unknown as { __listeners: typeof log }).__listeners = log;
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const passive = typeof options === 'object' && options !== null && options.passive === true;
      const from = (new Error().stack ?? '').split('\n')[2]?.trim() ?? '';
      log.push({ type, passive, from });
      return original.call(this, type, listener, options);
    };
  });
  await ready(page);
  const listeners = await page.evaluate(
    () => (window as unknown as { __listeners: { type: string; passive: boolean; from: string }[] }).__listeners,
  );

  const wheel = listeners.filter((l) => ['wheel', 'mousewheel', 'DOMMouseScroll'].includes(l.type));
  expect(wheel, 'no wheel listeners anywhere').toEqual([]);

  // Playwright adds a touchstart listener of its own from an injected script; only listeners
  // added by the page's code (loaded over http) count.
  const touch = listeners.filter(
    (l) => ['touchstart', 'touchmove'].includes(l.type) && !l.passive && /https?:\/\//.test(l.from),
  );
  expect(touch, 'no touch listener that could block scrolling').toEqual([]);

  const inline = await page.evaluate(() => document.querySelectorAll('[onwheel], [ontouchmove]').length);
  expect(inline).toBe(0);

  const css = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return { behavior: html.scrollBehavior, snapHtml: html.scrollSnapType, snapBody: body.scrollSnapType };
  });
  expect(css).toEqual({ behavior: 'auto', snapHtml: 'none', snapBody: 'none' });
});

test('inside the story, text moves one pixel for every pixel scrolled', async ({ page }) => {
  await ready(page);
  const heights = await page.evaluate(() => ({
    story: document.querySelector<HTMLElement>('[data-story]')!.getBoundingClientRect().top + window.scrollY,
    end: document.querySelector<HTMLElement>('[data-story]')!.getBoundingClientRect().bottom + window.scrollY,
  }));
  const step = 137;
  for (let y = heights.story; y < heights.end - 900; y += 640) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    const before = await page.evaluate(() =>
      [...document.querySelectorAll('[data-chapter] .chapter__text, [data-chapter] .chapter__proof')].map((el) => el.getBoundingClientRect().top),
    );
    await page.evaluate((v) => window.scrollBy(0, v), step);
    const after = await page.evaluate(() =>
      [...document.querySelectorAll('[data-chapter] .chapter__text, [data-chapter] .chapter__proof')].map((el) => el.getBoundingClientRect().top),
    );
    before.forEach((top, i) => expect(top - after[i], `chapter ${i} at scroll ${y}`).toBeCloseTo(step, 1));
  }
});

test('the story is exactly as tall as its rows: no spacers, nothing pinned', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const story = document.querySelector<HTMLElement>('[data-story]')!;
    const rows = [...story.querySelectorAll<HTMLElement>('[data-row]')].map((el) => el.getBoundingClientRect());
    const box = story.getBoundingClientRect();
    // Each row starts where the one before it ends, from the top of the story to its bottom.
    const gaps = rows.map((r, i) => Math.abs(r.top - (i === 0 ? box.top : rows[i - 1].bottom)));
    return {
      rows: rows.length,
      largestGap: Math.max(...gaps),
      tail: Math.abs(box.bottom - rows[rows.length - 1].bottom),
      spacers: document.querySelectorAll('.pin-spacer, [class*="pin-spacer"]').length,
      fixed: [...story.querySelectorAll<HTMLElement>('*')].filter((el) => getComputedStyle(el).position === 'fixed').length,
      // Every row holds something to read or look at.
      emptyRows: [...story.querySelectorAll<HTMLElement>('[data-row]')].filter(
        (el) => (el.textContent ?? '').trim().length < 20 && !el.querySelector('img, svg, canvas'),
      ).length,
    };
  });
  // The hero (one row: the first screen), the four abilities and the finale.
  expect(result.rows).toBeGreaterThanOrEqual(6);
  expect(result.largestGap).toBeLessThan(0.5);
  expect(result.tail).toBeLessThan(0.5);
  expect(result.spacers).toBe(0);
  expect(result.fixed).toBe(0);
  expect(result.emptyRows).toBe(0);
});

/**
 * The rule behind "nothing pinned": wherever you are in the story, scrolling must visibly
 * move the page. So at every position something that belongs to the page (text, a card, or
 * Nevo once the stage has let go of him) must be on screen and must move one pixel per pixel
 * scrolled. A screen showing only the sticky stage would fail this.
 */
for (const [width, height] of [
  [1440, 900],
  [2560, 1328],
  [1920, 1080],
  [1280, 720],
  [1100, 1400],
  [390, 780],
]) {
  test(`at every point of the story something on screen moves with the page (${width}×${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    const { top, end, view } = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>('[data-story]')!.getBoundingClientRect();
      return { top: box.top + window.scrollY, end: box.bottom + window.scrollY, view: window.innerHeight };
    });
    const step = 60;
    for (let y = Math.max(0, top - view * 0.5); y < end - view; y += 97) {
      // Both measurements are taken in one go, so nothing that moves on a timer (Nevo
      // breathes) can get between them.
      const moving = await page.evaluate(
        ({ y, step }) => {
          // Nothing sticks to the top of the screen, so all of it is visible.
          const nav = 0;
          // Everything in the story that belongs to the page: the text blocks and cards, and
          // Nevo (who only moves with the page once the stage has let go). He is measured by
          // the layer of his drawing that never moves on its own; its box is the whole
          // drawing, hair to shoulders.
          const parts = [
            ...document.querySelectorAll('.hero > *, .hero-get > * > *, .hero-slot__brain, .chapter__text > * > *, .chapter__proof > * > *, .act__picture, [data-canvas]'),
            document.querySelector('[data-bust] [clip-path="url(#nb-torso)"]')!,
          ];
          const measure = () =>
            parts.map((el) => {
              const b = el.getBoundingClientRect();
              return { top: b.top, shown: Math.max(0, Math.min(b.bottom, window.innerHeight) - Math.max(b.top, nav)) };
            });
          window.scrollTo(0, y);
          const before = measure();
          window.scrollBy(0, step);
          const after = measure();
          // How much is on screen, before and after, of the things that moved exactly as far as the scroll.
          return before
            .map((b, i) => (Math.abs(b.top - after[i].top - step) < 0.6 ? Math.min(b.shown, after[i].shown) : 0))
            .reduce((sum, shown) => sum + shown, 0);
        },
        { y, step },
      );
      expect(moving, `pixels of page content moving with the scroll at ${Math.round(y)}`).toBeGreaterThan(40);
    }
  });
}

test('the stage is a pure function of scroll position', async ({ page }) => {
  await ready(page);
  // The very end of the story: Nevo has the brain in his head and has finished reacting.
  const storyEnd = await page.evaluate(() => Math.round((window as unknown as { __stage: StageHook }).__stage.marks().landingTo + 40));

  // Jump straight to the end of the story.
  await page.evaluate((y) => window.scrollTo(0, y), storyEnd);
  await settle(page);
  const jumped = await signature(page);

  // Get to the same place gradually instead.
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  const top = await signature(page);
  for (let y = 0; y < storyEnd; y += 450) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate((y) => window.scrollTo(0, y), storyEnd);
  await settle(page);
  expect(await signature(page)).toBe(jumped);

  // And it runs backwards: back at the top, it is the opening pose again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  expect(await signature(page)).toBe(top);
  expect(top).not.toBe(jumped);
});

/**
 * The finale plays out well before the page has finished bringing Nevo up, so that when it is
 * all done (the brain in, the abilities round his head, "Nevo's brain") his face and the label
 * are on screen, and still are a good stretch of scrolling later; once the page has brought him
 * up, he is whole on screen.
 */
for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [2560, 1328],
  [390, 780],
]) {
  test(`when the finale has played out, Nevo's face and the label are on screen, and stay so for a while (${width}×${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    const marks = await page.evaluate(() =>
      (window as unknown as { __stage: { marks: () => { landingPlayed: number; landingTo: number } } }).__stage.marks(),
    );
    const onScreen = () =>
      page.evaluate(() => {
        const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
        // His drawing, hair to shoulders; his face; and the label over his head.
        const nevo = box('[data-bust] [clip-path="url(#nb-torso)"]');
        return { label: box('[data-callout]').top, top: nevo.top, face: box('[data-face]').bottom, bottom: nevo.bottom, view: window.innerHeight };
      });

    await page.evaluate((y) => window.scrollTo(0, y), Math.round(marks.landingPlayed));
    await settle(page);
    const state = await page.evaluate(() => (window as unknown as { __stage: StageHook }).__stage.state());
    expect(state.halo, 'the abilities are back out round his head').toBeGreaterThan(0.99);
    const done = await onScreen();
    expect(done.label, 'the label over his head').toBeGreaterThanOrEqual(0);
    expect(done.face, 'his face').toBeLessThanOrEqual(done.view);

    await page.evaluate((y) => window.scrollTo(0, y), Math.round(marks.landingPlayed + height * 0.2));
    await settle(page);
    expect((await onScreen()).label, 'a fifth of a screen later, the label is still on screen').toBeGreaterThanOrEqual(0);

    await page.evaluate((y) => window.scrollTo(0, y), Math.round(marks.landingTo));
    await settle(page);
    const up = await onScreen();
    expect(up.top, 'brought up, his hair is on screen').toBeGreaterThanOrEqual(0);
    // The drawing's box runs a little past his shoulders, which fade out.
    expect(up.bottom, 'and so are his shoulders').toBeLessThan(up.view * 1.08);
  });
}

/**
 * How many pixels differ by more than a trace between two screenshots of the same thing. Not
 * byte for byte: the faded edge of a scene that runs under the brain's box is composited a
 * level lighter or darker from one paint to the next, which is not anything moving.
 */
const changed = (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(
    async ([a, b]) => {
      const read = async (png: string) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [x, y] = await Promise.all([read(a), read(b)]);
      if (x.length !== y.length) return Infinity;
      let count = 0;
      for (let i = 0; i < x.length; i += 4) {
        if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > 8) count++;
      }
      return count;
    },
    [a.toString('base64'), b.toString('base64')],
  );

test('with reduced motion, nothing moves on a timer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const brain = page.locator('[data-hero-brain]');
  const first = await brain.screenshot();
  await page.waitForTimeout(1500);
  const second = await brain.screenshot();
  expect(await changed(page, first, second)).toBe(0);
});

test('without reduced motion, the brain does spin', async ({ page }) => {
  await ready(page);
  const brain = page.locator('[data-hero-brain]');
  const first = await brain.screenshot();
  await page.waitForTimeout(1500);
  const second = await brain.screenshot();
  // Its folds move: far more than a trace.
  expect(await changed(page, first, second)).toBeGreaterThan(500);
});
