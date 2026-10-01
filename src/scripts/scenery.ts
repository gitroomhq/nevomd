/**
 * The two scenes either side of the hero's brain are still pictures until this runs. It gives
 * each one its video (a short loop that starts and ends on that same picture) and plays it
 * only while it is on screen, and only for someone who has not asked for less motion or less
 * data. In one column the scenes are not shown at all, so nothing is downloaded there.
 */
const videos = [...document.querySelectorAll<HTMLVideoElement>('[data-scenery-video]')];

if (videos.length) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const onScreen = new Set<Element>();

  const update = () => {
    for (const video of videos) {
      if (onScreen.has(video) && !calm.matches && !saving) {
        if (!video.src) video.src = video.dataset.src!;
        // If the browser will not play it, the still picture simply stays.
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };

  const watcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      update();
    },
    { rootMargin: '200px' },
  );

  for (const video of videos) {
    watcher.observe(video);
    // Shown only once it is really playing, so there is never an empty frame over the still.
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
  }
  calm.addEventListener('change', update);
}
