/**
 * Installing: the hero and the end of the page show the MCP server's URL and a "How to use"
 * button that opens every agent's steps in a dialog; the same steps are in the full panel in
 * "How it works". Every command comes from content/site.ts, and copying works.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const site = readFileSync(new URL('../src/content/site.ts', import.meta.url), 'utf8');
const pick = (key: string) => site.match(new RegExp(`${key}: '([^']+)'`))![1];
const serverName = pick('serverName');
const mcpUrl = pick('mcpUrl');
const isMock = /mock: true/.test(site);

/** The shell commands for adding the MCP server, by agent. */
const mcpCommands: Record<string, string> = {
  'Claude Code': `claude mcp add --transport http ${serverName} ${mcpUrl}`,
  Codex: `codex mcp add ${serverName} --url ${mcpUrl}`,
  OpenClaw: `openclaw mcp add ${serverName} --url ${mcpUrl} --transport streamable-http`,
  Hermes: `hermes mcp add ${serverName} --url ${mcpUrl}`,
  'Gemini CLI': `gemini mcp add --transport http ${serverName} ${mcpUrl}`,
};

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('the hero shows the MCP server URL, and it copies', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero-get .quick');

  await expect(hero.locator('.cmd__text')).toHaveText(mcpUrl);
  await hero.getByRole('button', { name: 'Copy the MCP server URL' }).click();
  await expect(hero.getByText('Copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mcpUrl);
});

test('the hero has nothing above the headline, and no buttons but Copy and How to use', async ({ page }) => {
  await page.goto('/');
  // No top bar, no menu, no logo, no call-to-action buttons: the headline comes first, and the
  // only controls are the Copy for the MCP server URL and the How to use beside it.
  await expect(page.locator('header, nav[aria-label="Sections"], .strip, .btn')).toHaveCount(0);
  const first = await page.locator('main').evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) if (node.textContent?.trim()) return node.parentElement?.closest('h1, h2, h3, p, button, a, div')?.tagName;
    return null;
  });
  expect(first).toBe('H1');
  const controls = await page.locator('.hero-row, .hero-get .quick').locator('a, button, select').evaluateAll((els) =>
    els.map((el) => (el.hasAttribute('data-copy') ? 'copy' : el.hasAttribute('data-howto') ? 'howto' : el.tagName.toLowerCase())),
  );
  expect(controls).toEqual(['copy', 'howto']);
});

test('the hero and the end show the MCP server URL alone, with no instructions', async ({ page }) => {
  await page.goto('/');
  for (const block of ['.hero-get', '[data-night]']) {
    const install = page.locator(`${block} .quick`);
    await expect(install.locator('.cmd__text')).toHaveText(mcpUrl);
    // No switch, no agent menu and no notes: every agent's steps are behind How to use.
    await expect(install.locator('[role="tab"], select, p, label')).toHaveCount(0);
  }
  // Nothing on the page offers the skill or its CLI any more.
  await expect(page.locator('[role="tab"]')).toHaveCount(0);
  for (const text of await page.locator('.cmd__text').allTextContents()) expect(text).not.toMatch(/skills? (add|install)/);
});

test('every MCP line in the full panel is built from the one server name and URL', async ({ page }) => {
  await page.goto('/#how');
  const panel = page.locator('#how .install');

  for (const [agent, command] of Object.entries(mcpCommands)) {
    await panel.getByRole('button', { name: agent, exact: true }).click();
    await expect(panel.locator('[data-agent-panel]:not([hidden]) .cmd__text')).toHaveText(command);
  }

  // No command on the page carries a key: sign-in happens over OAuth the first time the agent connects.
  const all = await page.locator('.cmd__text').allTextContents();
  for (const text of all) expect(text).not.toMatch(/api[-_ ]?key|bearer|authorization/i);
});

test('How to use opens every agent’s steps, Claude and ChatGPT first, and closes', async ({ page }) => {
  await page.goto('/');
  for (const where of ['hero', 'final']) {
    const dialog = page.locator(`#${where}-howto`);
    await expect(dialog).toBeHidden();
    await page.locator(`[data-howto="${where}-howto"]`).click();
    await expect(dialog).toBeVisible();
    const agents = await dialog.locator('[data-agent]').allTextContents();
    expect(agents.slice(0, 2).map((a) => a.trim())).toEqual(['Claude', 'ChatGPT']);
    await expect(dialog.locator('[data-agent-panel]:not([hidden]) .cmd__text')).toHaveText(mcpUrl);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('the agent chosen in How it works is remembered', async ({ page }) => {
  await page.goto('/#how');
  const panel = page.locator('#how .install');
  await panel.getByRole('button', { name: 'Hermes', exact: true }).click();

  await page.reload();
  await expect(panel.locator('[data-agent="hermes"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('[data-agent-panel]:not([hidden]) .cmd__text')).toHaveText(mcpCommands.Hermes);
});

/**
 * The launch check from PLAN.md section 9: the commands printed on the page have to work.
 * Skipped while the names are mocks; once `install.mock` is false it talks to the real things.
 */
test('launch check: the MCP server answers', async ({ request }) => {
  test.skip(isMock, 'install names in content/site.ts are still mocks (install.mock = true)');

  // The MCP server: a plain initialize request with no token is turned away with a 401
  // that points the agent at the OAuth sign-in, which is how every agent gets in.
  const response = await request.post(mcpUrl, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'launch-check', version: '1.0.0' } },
    },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()['www-authenticate']).toMatch(/resource_metadata=/i);
});
