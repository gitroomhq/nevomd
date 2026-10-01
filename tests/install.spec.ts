/**
 * Installing: the hero and the end of the page switch between the MCP server (its URL, shown
 * first) and the CLI (the skill command), with no instructions; every agent's steps are in the
 * full panel in "How it works". Every command comes from content/site.ts, and copying works.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const site = readFileSync(new URL('../src/content/site.ts', import.meta.url), 'utf8');
const pick = (key: string) => site.match(new RegExp(`${key}: '([^']+)'`))![1];
const skillRepo = pick('skillRepo');
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

test('the hero opens on the MCP server, switches to the CLI, and both copy', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero-get');
  const shown = hero.locator('[role="tabpanel"]:not([hidden]) .cmd__text');

  // The MCP server first: its URL, to add to any agent.
  await expect(hero.getByRole('tab', { name: 'MCP' })).toHaveAttribute('aria-selected', 'true');
  await expect(shown).toHaveText(mcpUrl);
  await hero.getByRole('button', { name: 'Copy the MCP server URL' }).click();
  await expect(hero.getByText('Copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mcpUrl);

  // The CLI: the skill command.
  await hero.getByRole('tab', { name: 'CLI' }).click();
  await expect(shown).toHaveText(`npx skills add ${skillRepo}`);
  await hero.getByRole('button', { name: 'Copy the skill command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`npx skills add ${skillRepo}`);
});

test('the hero has nothing above the headline, and no buttons but the switch and Copy', async ({ page }) => {
  await page.goto('/');
  // No top bar, no menu, no logo, no call-to-action buttons: the headline comes first, and the
  // only controls are the MCP / CLI switch and a Copy for each.
  await expect(page.locator('header, nav[aria-label="Sections"], .strip, .btn')).toHaveCount(0);
  const first = await page.locator('main').evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) if (node.textContent?.trim()) return node.parentElement?.tagName;
    return null;
  });
  expect(first).toBe('H1');
  const controls = await page.locator('.hero-row, .hero-get').locator('a, button, select').evaluateAll((els) =>
    els.map((el) => (el.getAttribute('role') === 'tab' ? 'tab' : el.hasAttribute('data-copy') ? 'copy' : el.tagName.toLowerCase())),
  );
  expect(controls).toEqual(['tab', 'tab', 'copy', 'copy']);
});

test('the hero and the end switch between MCP and CLI, with no instructions', async ({ page }) => {
  await page.goto('/');
  for (const block of ['.hero-get', '[data-night]']) {
    const install = page.locator(`${block} [data-install]`);
    await expect(install.getByRole('tab')).toHaveText(['MCP', 'CLI']);
    // No agent menu and no notes: every agent's steps are in How it works.
    await expect(install.locator('select, p, label')).toHaveCount(0);
  }
  await expect(page.locator('#how .install').getByRole('tab', { name: 'MCP' })).toHaveCount(1);
});

test('every MCP line in the full panel is built from the one server name and URL', async ({ page }) => {
  await page.goto('/#how');
  const panel = page.locator('#how .install');
  await panel.getByRole('tab', { name: 'MCP' }).click();

  for (const [agent, command] of Object.entries(mcpCommands)) {
    await panel.getByRole('button', { name: agent, exact: true }).click();
    await expect(panel.locator('[data-agent-panel]:not([hidden]) .cmd__text')).toHaveText(command);
  }

  // No command on the page mentions a key or a login: the server is open.
  const all = await page.locator('.cmd__text').allTextContents();
  for (const text of all) expect(text).not.toMatch(/api[-_ ]?key|bearer|authorization/i);
});

test('the agent chosen in How it works is remembered', async ({ page }) => {
  await page.goto('/#how');
  const panel = page.locator('#how .install');
  await panel.getByRole('tab', { name: 'MCP' }).click();
  await panel.getByRole('button', { name: 'Hermes', exact: true }).click();

  await page.reload();
  await panel.getByRole('tab', { name: 'MCP' }).click();
  await expect(panel.locator('[data-agent="hermes"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('[data-agent-panel]:not([hidden]) .cmd__text')).toHaveText(mcpCommands.Hermes);
});

/**
 * The launch check from PLAN.md section 9: the commands printed on the page have to work.
 * Skipped while the names are mocks; once `install.mock` is false it talks to the real things.
 */
test('launch check: the skill repo and the MCP server answer', async ({ request }) => {
  test.skip(isMock, 'install names in content/site.ts are still mocks (install.mock = true)');

  // The skill: the same CLI the page tells people to run, asked only to list what it finds.
  const listing = execSync(`npx -y skills add ${skillRepo} --list`, { encoding: 'utf8', timeout: 120_000 });
  expect(listing.toLowerCase()).toContain('skill');

  // The MCP server: a plain initialize request, with no key, as the page promises.
  const response = await request.post(mcpUrl, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'launch-check', version: '1.0.0' } },
    },
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('"result"');
});
