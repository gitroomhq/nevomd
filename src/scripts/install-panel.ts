/**
 * Behaviour for the install blocks: the copy buttons everywhere, and, in the full panel in "How
 * it works", the choice of agent, which is remembered. The small blocks in the hero and at the
 * end are the MCP server's URL, its Copy, and a "How to use" button that opens the full panel
 * in a dialog.
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

/** "How to use": opens the dialog with every agent's steps. Esc closes it natively, so do a close button and a click on the backdrop. */
function setupHowto() {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-howto]')) {
    const dialog = document.getElementById(btn.dataset.howto!) as HTMLDialogElement | null;
    if (!dialog) continue;
    btn.addEventListener('click', () => {
      dialog.showModal();
      track('howto', { where: btn.dataset.howtoName ?? '' });
    });
    dialog.querySelector('[data-howto-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
}

/** The install guides: one step at a time, with Back and Next. Without this script every step shows. */
function setupSteppers() {
  for (const stepper of document.querySelectorAll<HTMLElement>('[data-stepper]')) {
    const steps = [...stepper.querySelectorAll<HTMLElement>('[data-step]')];
    const nav = stepper.querySelector<HTMLElement>('[data-stepper-nav]')!;
    const prev = nav.querySelector<HTMLButtonElement>('[data-step-prev]')!;
    const next = nav.querySelector<HTMLButtonElement>('[data-step-next]')!;
    const dots = [...nav.querySelectorAll<HTMLElement>('.stepper__dots > span')];
    let at = 0;
    const show = (i: number) => {
      at = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach((s, j) => (s.hidden = j !== at));
      dots.forEach((d, j) => d.classList.toggle('is-on', j === at));
      prev.disabled = at === 0;
      next.disabled = at === steps.length - 1;
    };
    prev.addEventListener('click', () => show(at - 1));
    next.addEventListener('click', () => show(at + 1));
    nav.hidden = steps.length < 2;
    show(0);
  }
}

const roots = [...document.querySelectorAll<HTMLElement>('[data-install]')];
setupAgents(roots);
setupCopy();
setupHowto();
setupSteppers();
