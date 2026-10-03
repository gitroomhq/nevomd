/**
 * Behaviour for the install blocks: the copy buttons everywhere, and, in the full panel in "How
 * it works", the choice of agent, which is remembered. The small blocks in the hero and at the
 * end are the MCP server's URL and its Copy alone.
 */

const AGENT_KEY = 'nevos-brain:agent';

function track(event: string, detail: Record<string, string>) {
  // Analytics hook. DataFast is wired in at launch; until then this is a no-op.
  (window as unknown as { datafast?: (e: string, d: Record<string, string>) => void }).datafast?.(event, detail);
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
setupAgents(roots);
setupCopy();
