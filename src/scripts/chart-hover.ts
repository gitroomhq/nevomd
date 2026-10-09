/**
 * Hover and keyboard readout for the MRR chart: a crosshair that snaps to the nearest month
 * and a tooltip with the value, as MRR or ARR, whichever the card shows. The same numbers are
 * in the table under the chart, so the tooltip never gates anything.
 */
type HoverPoint = { x: number; y: number; v: string; va: string; d: string };

for (const root of document.querySelectorAll<HTMLElement>('[data-chart]')) {
  const svg = root.querySelector('svg')!;
  const hit = root.querySelector<SVGRectElement>('[data-hit]')!;
  const hover = root.querySelector<SVGGElement>('[data-hover]')!;
  const line = root.querySelector<SVGLineElement>('[data-hover-line]')!;
  const dot = root.querySelector<SVGCircleElement>('[data-hover-dot]')!;
  const tip = root.querySelector<HTMLElement>('[data-tip]')!;
  const tipValue = root.querySelector<HTMLElement>('[data-tip-value]')!;
  const tipDate = root.querySelector<HTMLElement>('[data-tip-date]')!;
  const points: HoverPoint[] = JSON.parse(root.querySelector('[data-points]')!.textContent || '[]');
  const viewW = Number(root.dataset.viewW);
  const viewH = Number(root.dataset.viewH);
  let index = points.length - 1;

  const show = (i: number) => {
    index = Math.max(0, Math.min(points.length - 1, i));
    const p = points[index];
    line.setAttribute('x1', String(p.x));
    line.setAttribute('x2', String(p.x));
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    hover.removeAttribute('hidden');
    tipValue.textContent = root.closest<HTMLElement>('[data-unit]')?.dataset.unit === 'arr' ? p.va : p.v;
    tipDate.textContent = p.d;
    const rect = svg.getBoundingClientRect();
    const left = (p.x / viewW) * rect.width;
    // Keep the tooltip inside the card at both ends of the line.
    tip.style.left = `${Math.max(70, Math.min(rect.width - 70, left))}px`;
    tip.style.top = `${(p.y / viewH) * rect.height}px`;
    tip.hidden = false;
  };

  const hide = () => {
    hover.setAttribute('hidden', '');
    tip.hidden = true;
  };

  hit.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * viewW;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - vx) < Math.abs(points[best].x - vx)) best = i;
    }
    show(best);
  });
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('focus', () => show(index));
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', (e) => {
    // Left and right step through the months. Every other key is left alone.
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
}
