/**
 * Behaviour for the install blocks: the copy buttons everywhere, and, in the full panel in "How
 * it works" (the only place with the MCP server), the Skill / MCP switch and the choice of
 * agent, which is remembered. The small blocks in the hero and at the end are the skill command
 * and its Copy alone.
 */

const AGENT_KEY = 'nevos-brain:agent';

function track(event: string, detail: Record<string, string>) {
  // Analytics hook. DataFast is wired in at launch; until then this is a no-op.
  (window as unknown as { datafast?: (e: string, d: Record<string, string>) => void }).datafast?.(event, detail);
}

function setupTabs(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];

  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    for (const p of panels) p.hidden = p.dataset.panel !== tab.dataset.tab;
    if (focus) tab.focus();
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      // Left and right only. Home, End and the vertical keys keep scrolling the page.
      if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length], true);
      else if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length], true);
    });
  }
}

/** The agent is chosen with a row of buttons in the full panel. */
function setupAgents(roots: HTMLElement[]) {
  const pick = (id: string) => {
    for (const root of roots) {
      const panels = [...root.querySelectorAll<HTMLElement>('[data-agent-panel]')];
      if (!panels.some((p) => p.dataset.agentPanel === id)) continue;
      for (const p of panels) p.hidden = p.dataset.agentPanel !== id;
      for (const b of root.querySelectorAll<HTMLButtonElement>('[data-agent]')) b.setAttribute('aria-pressed', String(b.dataset.agent === id));
      for (const menu of root.querySelectorAll<HTMLSelectElement>('[data-agent-select]')) menu.value = id;
    }
  };

  const choose = (id: string) => {
    pick(id);
    try {
      localStorage.setItem(AGENT_KEY, id);
    } catch {
      // private mode: the choice just isn't remembered
    }
  };

  for (const root of roots) {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-agent]')) b.addEventListener('click', () => choose(b.dataset.agent!));
    for (const menu of root.querySelectorAll<HTMLSelectElement>('[data-agent-select]')) menu.addEventListener('change', () => choose(menu.value));
  }

  try {
    const saved = localStorage.getItem(AGENT_KEY);
    if (saved) pick(saved);
  } catch {
    // ignore
  }
}

function setupCopy() {
  document.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
    if (!btn) return;
    const label = btn.querySelector<HTMLElement>('[data-copy-label]');
    const value = btn.dataset.copy ?? '';
    let ok = true;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      ok = false;
    }
    btn.classList.toggle('is-copied', ok);
    window.setTimeout(() => btn.classList.remove('is-copied'), 1800);
    if (label) {
      label.textContent = ok ? 'Copied' : 'Press ⌘C';
      if (!ok) {
        // Clipboard blocked: select the text so a manual copy is one keystroke away.
        const text = btn.parentElement?.querySelector('.cmd__text');
        if (text) {
          const range = document.createRange();
          range.selectNodeContents(text);
          const sel = getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
      window.setTimeout(() => (label.textContent = 'Copy'), 1800);
    }
    if (ok) track('copy', { what: btn.dataset.copyName ?? '' });
  });
}

const roots = [...document.querySelectorAll<HTMLElement>('[data-install]')];
roots.forEach(setupTabs);
setupAgents(roots);
setupCopy();
