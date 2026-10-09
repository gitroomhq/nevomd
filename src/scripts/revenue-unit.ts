/**
 * The MRR / ARR switch on the proof card. Every figure is in the page twice and CSS shows the
 * one that matches the card's data-unit, so this only flips that and the buttons. Without
 * script the switch stays hidden and the card shows MRR.
 */
for (const card of document.querySelectorAll<HTMLElement>('[data-unit]')) {
  const group = card.querySelector<HTMLElement>('[data-units]');
  if (!group) continue;
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('button[data-unit-pick]')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      card.dataset.unit = button.dataset.unitPick;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
    });
  }
  group.hidden = false;
}
