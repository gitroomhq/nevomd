/**
 * Where things sit on the stage, in scene units (the scene is 1000×1000 and scaled to fit).
 * Shared by the markup (Stage.astro), the timeline (story-timeline.ts) and the loop (stage.ts).
 */

const BRAIN_SIZE = 620;
const BRAIN_TOP = 208;

/**
 * The cerebrum inside the square the brain is drawn in, as fractions of that square: how
 * wide it is seen from the side (its widest), how tall, and how far down its middle sits.
 * Measured from the renderer's output; Story.astro places the hero's still image with the
 * same numbers.
 */
export const BODY = { width: 0.838, height: 0.526, v: 0.448 };

export const SCENE = {
  size: 1000,
  brain: {
    size: BRAIN_SIZE,
    top: BRAIN_TOP,
    /** Centre of the square the brain is drawn in. */
    x: 500,
    y: BRAIN_TOP + BRAIN_SIZE / 2,
    /** Centre of the cerebrum itself: the links and the ring are drawn around this point. */
    bodyY: Math.round(BRAIN_TOP + BODY.v * BRAIN_SIZE),
  },
  /** Size of the square each ability object is drawn in. */
  icon: 265,
};

/** The four ability objects, around the brain: upper left, upper right, lower left, lower right. */
export const NODES = [
  { x: 138, y: 160 },
  { x: 862, y: 160 },
  { x: 138, y: 750 },
  { x: 862, y: 750 },
];

/** The cut across the forehead where the top of the head lifts off, in bust image pixels (1024). */
export const LID = { cx: 504, cy: 238, rx: 190, ry: 36 };

const BUST_SIZE = 640;
const BUST_TOP = 330;
const k = BUST_SIZE / 1024;

export const BUST = {
  size: BUST_SIZE,
  top: BUST_TOP,
  /** Placed so the opening in the head sits on the scene's centre line. */
  left: Math.round(500 - LID.cx * k),
  /** Where the lid hinges, in bust image pixels. */
  hinge: `${LID.cx - LID.rx} ${LID.cy}`,
  /** The top of his hair and the end of his shoulders, in scene units. */
  hairTop: BUST_TOP + 48 * k,
  bottom: BUST_TOP + 950 * k,
  /** The opening in the head, in scene units. */
  opening: { x: 500, y: Math.round(BUST_TOP + LID.cy * k) },
};

/**
 * The head, so it can turn on the neck. Everything above this line across the jaw belongs to
 * the head and moves with it; the neck and shoulders below stay where they are. In bust image pixels.
 */
export const HEAD = {
  /** The jaw, from his left cheek round the chin to his right cheek, just outside the drawn line. */
  jaw: 'H666L657 524L642 548L624 568L604 585L582 597L558 606L532 612H486L460 606L434 596L412 583L394 566L377 546L363 522L350 500',
  /** The height at which the jaw line meets the cheeks. */
  cut: 500,
  /** The point the head turns about: the middle of the neck. */
  pivot: { x: 510, y: 575 },
  /** The two lines of the neck, which carry on up behind the jaw: x and width. */
  neck: [
    { x: 371, width: 9 },
    { x: 647, width: 9 },
  ],
  /** The mouth's middle, for the round mouth he makes when he is amazed. */
  mouth: { x: 510, y: 486 },
};

/**
 * Brain scale for each pose of the finale: smaller as it arrives with the abilities round
 * it, big once it has them, then small enough to hover over Nevo's head and smaller still to
 * fit inside it.
 */
export const POSE = { arrive: 0.62, big: 1, hover: 0.6, inside: 0.4 };

/** The four ability objects, in the order of the chapters. */
export const ABILITY_OBJECTS = ['radar', 'antenna', 'tactics', 'rocket'] as const;

/**
 * The finale. Nevo stands in the page below the last screen the stage sticks to, so the page's
 * own scroll carries him up to the brain, which waits in the middle of the screen.
 */
export const FINALE = {
  /**
   * Where the cerebrum's centre hovers before it drops in (high enough that the lid can swing
   * open under it), and where it rests inside, in scene units.
   */
  hover: BUST.hairTop - 150 - (BODY.height * BRAIN_SIZE * POSE.hover) / 2,
  inside: BUST.opening.y - 20,
  /**
   * Where Nevo's hair is when the page has finished bringing him up, as a share of the screen's
   * height from its top. The landing has played out a little before, with him lower (see PLAY
   * in scroll-progress.ts).
   */
  restAt: 0.2,
  /** Scene units the finished picture needs: tall (his hair to his shoulders) and wide (with the objects beside him). */
  tall: 880,
  wide: 960,
  /** The height reserved for him in the page, in scene units. See `.finale__slot` in Story.astro. */
  slot: 575,
  /** The four ability objects, back out around his head at the end. */
  halo: [
    { x: 196, y: 372 },
    { x: 804, y: 372 },
    { x: 150, y: 590 },
    { x: 850, y: 590 },
  ],
  haloScale: 0.6,
  callout: { x: 500, y: 236 },
};

/** The brain's angle in the still image, in turns. The live canvas starts from the same angle. */
export const STILL_TURNS = 0.14;
