# Nevo's Brain: marketing site plan

Plan v4, 1 Oct 2026. This file is the source of truth; change it here first.

**Where things stand:** the page is built and runs locally (`pnpm dev`). The hero's two scenes loop; at the bottom of each ability section is Nevo with the brain, played by the scroll. What is left: your review of the copy, real install names, and the launch work in section 10.

**Changed in v4**, from your feedback while it was being built:

1. No top bar, no menu, no logo, no "Get the brain" or "See what it knows" buttons, no MRR card in the hero. The hero is the headline, one paragraph, and the one line to copy: the MCP server's URL. (There was an MCP / CLI switch; the CLI, the skill command, was cut: the MCP is enough.) No instructions there: every agent's steps are in "How it works".
2. The hero is smaller type with more room, and the brain is smaller: it turns on a dock between two drawn scenes, a robot lab on the left and a rocket on the right, the way Lemonade's hero has a street either side.
3. The brain no longer travels beside the chapters. Each ability is a Lemonade section: centered text; under it a picture of its own (a radar, three waves, a channel board, a before-and-after), never the same component twice; and at the bottom, on the section's edge, Nevo doing that section's thing with the brain: holding it up like a radar, surfing with it, kicking it into a goal, watering it until it grows. The scroll plays each one (section 6.2). White and grey bands alternate.
4. Every drawing has one touch of pink, as each of Lemonade's does: the lab's dish, the rocket's nose and fins, the radar arcs, the surfboard, the goal's net, the watering can.
5. The finale keeps the brain dropping into Nevo's head. The brain comes back with the four abilities round it, takes them in, and grows, then the page brings Nevo up under it. Nevo turns his head, opens the top of it, reacts, shakes the brain into place, winks, and follows your mouse.
6. The 3D brain has real folds: a winding pattern grown on its shape, not a formula, with the bumps and embossing gone.
7. Everything scales with the window above 1440×900, so a big screen gets a big page.

## 1. What this is

A one-page marketing site for **Nevo's Brain**: an MCP server that gives an AI agent Nevo's distribution and marketing playbooks (finding niches, finding hypes, marketing tactics, growth hacking). It is free, with no signup.

The page has one job: get a founder who already works with an AI agent to copy the install command.

| In scope | Out of scope |
|---|---|
| The marketing page: copy, illustrations, scroll animation | Building the MCP server |
| The real commands to add the MCP | Checkout, accounts, waitlist (it is free, no signup) |
| Proof: the ARR number, Stripe-style charts | Playbook pages hosted on the site (parked, section 13) |

## 2. The calls this plan makes

1. **Lemonade's visual system**: type, palette, line-art drawings with one touch of pink, centered sections, alternating white and grey bands. What Lemonade doesn't have is the 3D brain.
2. **Nothing is pinned and nothing sticks.** Every part of the page scrolls at the browser's speed. The only thing held on screen is the brain during the finale, while the page carries Nevo up to it (rules in 6.1, enforced by tests).
3. **The brain and the ability objects are real 3D, built in code.** No model files to download, no 3D library.
4. **The drawings are generated, then brought to life.** The image model draws them in Lemonade's hand (with crops of Lemonade's hero as a style reference). Seedance turns the hero's two into loops that start and end on the same picture, and each of Nevo's scenes into a movement from a first key frame to a last one, which the scroll plays.
5. **The install command is in the hero.** No button to press first.
6. **Charts are drawn from real numbers.** The image model draws illustrations, never data.
7. **Static site:** Astro, GSAP core for the timeline, no scroll library, no backend.

## 3. Audience and message

**Who:** founders and indie hackers who build with an agent (Claude Code, Cursor, OpenClaw, Hermes). The agent can build the product. Nobody in the room knows distribution.

**Promise:** your agent gets the distribution playbook behind a bootstrapped SaaS doing close to $3M ARR.

**Why believe it:** Stripe-verified revenue, one founder, $0 raised (in the Proof section and Meet Nevo).

**Price:** free. No card, no key; the agent signs in once with your email over OAuth. It is said in "How it works" and the questions (it was under the hero's command until you had that line taken out).

**Voice:** first person, specific numbers, no guru tone. Headlines are short the way Lemonade's are.

## 4. Visual system

Measured from lemonade.com on 30 Sep 2026. The tokens live in `src/styles/tokens.css`.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#4A4A4A` | All text, all outlines |
| `--ink-muted` | `#767676` | Secondary text |
| `--bg` / `--band` | `#FFFFFF` / `#F7F7F7` | Alternating full-width bands |
| `--pink` | `#FF0083` | The one accent: the chosen tab, one detail per drawing, chart lines, lit lobes |
| `--pink-text` / `--pink-deep` | `#DB0070` / `#CC0068` | The accent darkened until small text passes contrast |
| `--pink-wash` | `#FFE8F3` | The tab that is not chosen |
| H1 | Merriweather 400, 28 to 38 px | Hero only, a step below Lemonade's 55 px so the hero has room |
| H2 | Lato 700, 30 to 44 px | Section headlines |
| Body | Lato 400, 18/28 px | |
| Handwriting | Caveat 700 | Ability names, the "Nevo's brain" label, notes on the chart |

**Sizes are in rem**, and the root size grows with the window once it is larger than 1440×900 in both directions (up to 26 px), so a 2560×1328 window gets a page scaled up, not a small page with wide margins.

**Drawings:** thin grey outlines, white and light-grey fills, a pale layer behind, one small area of flat pink. On the grey bands the drawings are multiplied into the band, so their white paper takes its colour.

**What we take and what we don't:** the system, not the assets. No Lemonade illustrations, logo or copy. Their hero was used only as a style reference for the image model, with the instruction to copy nothing it shows.

## 5. Page map

```
┌───────────────────────────────────────────────────────────────┐
│              H1, centered, two lines                          │
│              one paragraph                                    │
│              https://mcp.nevo.md/mcp                       Copy   │
│                                                               │
│  robot lab        ( 3D brain on its dock )       rocket pad   │
├─ grey ────────────────────────────────────────────────────────┤
│              Niche radar: centered text                       │
│                                                               │
│     its own picture: the radar, read out ($20k)               │
│                                                               │
│      [ Nevo with the brain, standing on the edge ]            │
├─ white ───────────────────────────────────────────────────────┤
│              Hype antenna                                     │
├─ grey ────────────────────────────────────────────────────────┤
│              Tactics board                                    │
├─ white ───────────────────────────────────────────────────────┤
│              Growth engine                                    │
├─ grey ────────────────────────────────────────────────────────┤
│   the brain returns with the four abilities, takes them in,   │
│   and drops into Nevo's head. "It all came out of one head."  │
├───────────────────────────────────────────────────────────────┤
│ Proof · How it works (the full panel: every agent's MCP steps)│
│ · Questions · "Nevo’s brain never sleeps" and the MCP URL     │
│ on the top of his room: at the very bottom the lights         │
│ go off. The page ends with the room: no footer.              │
└───────────────────────────────────────────────────────────────┘
```

### Copy

All of it is in `src/content/site.ts`, as a first draft for you to rewrite.

- **H1:** "Your agent can build anything. Now teach it to sell."
- **Sub:** "Nevo's Brain is an MCP server that plugs the distribution playbook behind Postiz into your agent: how to find a niche, catch a hype early, pick the channel, and grow the number."

| Ability | H2 | Nevo's scene |
|---|---|---|
| Niche radar | Finds the audience nobody is serving. | He holds the brain up like a radar (pink arcs) and swings it from the crowded town to the lone cottage, frown to smile |
| Hype antenna | Catches the wave before it gets crowded. | He sits on a pink surfboard with the brain; the wave rises, he grabs the brain and rides it |
| Tactics board | Knows which channels work this year. | Beside a whiteboard play, he kicks the brain into a goal with a pink net and cheers |
| Growth engine | Grows the number without more traffic. | Kneeling, he waters a seedling brain in a pot with a pink can; it grows tall and big |

- **Meet Nevo:** "It all came out of one head." and a short bio. Check the facts (section 12).
- **Proof:** "Every play has a receipt." **Final CTA:** "Nevo’s brain never sleeps", over Nevo asleep while his brain works at the laptop; the lights go off at the bottom of the page (6.2).

Between each ability's text and its drawing is a picture of its own (`src/components/panels/`), from the articles, with its number and a link to its source:

| Ability | Picture |
|---|---|
| Niche radar | The radar screen, read out: a crowd of dots, "the big players, like Buffer and Sprout Social: all selling to marketers", and one pink blip alone, "Postiz went here: $20k MRR". The sweep turns and the blip pings |
| Hype antenna | Three waves, each bigger: n8n (shipped a node), MCP (an MCP server), agents (a skill). The last is pink: "$20k → $100k MRR in three months" |
| Tactics board | A board of the channels in the text, working now against getting harder, with one channel's rules (Reddit); beside it a stat circle, "2× MRR in one month" from one outreach campaign |
| Growth engine | "My trial-to-paid is 8%. What do I fix first?" and the brain's answer, beside a before-and-after: the same trials, MRR $15k to $18k, +20% |

The sizes of the dots and waves are pictures, not data; the columns in the before-and-after start from zero.

### Install

**In the hero and the last section:** the one line to copy, the MCP server's URL. No switch, no agent menu, no notes. **In "How it works":** the full panel, with every agent's MCP steps; the agent chosen there is remembered. MCP only: the skill (`npx skills add …`, its other installers and the "Tell your agent" line) was cut, the MCP is enough.

**MCP,** checked against each CLI's help or docs:

| Agent | Command or steps |
|---|---|
| Claude Code | `claude mcp add --transport http nevos-brain https://mcp.nevo.md/mcp` |
| Claude (web, desktop) | Customize → Connectors → + → Add custom connector → paste the URL |
| Cursor | "Add to Cursor" link, or in `~/.cursor/mcp.json`: `{"mcpServers":{"nevos-brain":{"url":"https://mcp.nevo.md/mcp"}}}` |
| Codex | `codex mcp add nevos-brain --url https://mcp.nevo.md/mcp` |
| OpenClaw | `openclaw mcp add nevos-brain --url https://mcp.nevo.md/mcp --transport streamable-http` |
| Hermes | `hermes mcp add nevos-brain --url https://mcp.nevo.md/mcp` |
| Gemini CLI | `gemini mcp add --transport http nevos-brain https://mcp.nevo.md/mcp` |

The names are mocks until the real ones exist. They live in one place, `install` in `site.ts`, with `mock: true`; the launch check in the tests is skipped while that flag is set, and once it is cleared it sends the MCP server an `initialize` request with no token and expects the OAuth 401. The MCP has no key; it signs users in with OAuth2 and their email, free.

## 6. The brain story

### 6.1 Scroll rules

What you ruled out: smooth-scroll libraries that change speed or inertia, and pinned sections where the wheel turns but the page doesn't move. The page has neither.

1. No `wheel` listeners at all. No `preventDefault` on wheel, touch or the keys that scroll.
2. No Lenis, Locomotive, ScrollSmoother, `normalizeScroll` or scroll-snap.
3. Nothing is pinned and nothing sticks. Every row of the story holds something you can see.
4. At every point of the story, something on screen moves one pixel per pixel scrolled. The brain is held on screen only while the page carries Nevo up to it.
5. The stage is a pure function of scroll position: it runs backwards when you scroll up and is right if you land in the middle of the page. The only time-based motion is idle: the brain's spin (and its coasting after you flick it), the hero's loops, the radar's sweep, Nevo breathing, blinking, glancing about and following the mouse. Nevo's scenes in the ability sections are, like the stage, a function of scroll position.
6. Animated values may ease toward their target over about 90 ms. Scroll position itself is never touched.
7. Anchor links use the browser's default jump.

`tests/scroll-rules.spec.ts` checks all of these on every run, rule 4 at six window sizes from a phone to 2560×1328.

### 6.2 Layout

- **Hero:** the first screen, all of it (`.hero-screen`, at least 100svh, with a little room under it): the headline, the paragraph and the line to copy together at the top; the brain on its dock and the two scenes standing at the bottom of the screen, with the space left over between the two; the first ability starts at the fold. The brain turns on its own canvas (`src/brain/hero.ts`), 22 rem wide at most, over a still image of itself for the first paint. With a mouse it can be picked up: drag it sideways to spin it (a flick coasts on), up or down to tip it toward you or away (at most about 35°); let go and it sits back up and carries on turning. The cursor is a hand where there is a mouse. On a touch screen it cannot be picked up at all, so a swipe over it always scrolls the page and nobody gets caught on it (it used to take sideways swipes; you were afraid people would get stuck). Pointer events only, a mouse's only: no wheel or touch listeners, and the browser's own touch handling. With reduced motion it stays where it is put. The two scenes stand on the hero's bottom edge at the window's edges, the same height, a little taller than the brain, and never so wide that they reach it; their pale backgrounds fade out before the brain. Under 900 px wide the scenes are hidden.
- **Abilities:** a section each: the text centered; well below it, the section's picture (60 rem wide at most; rearranged for one column under 860 px); and well below that Nevo's scene (`NevoAct.astro`), centered and standing on the section's bottom edge, no wider than 44 rem and no taller than 46% of the screen. Lots of room above each one. White and grey alternate from the hero to the finale.
- **Nevo's scenes** (`src/scripts/nevo-acts.ts`): each is a short video from a first key frame to a last, and the scroll plays it, like the finale: it starts once 85% of the picture is on screen and has played out when the picture's middle reaches the middle of the screen: about a third of a screen of scrolling (about 310 px at 1440×900), so the end is seen whole, with room to scroll on before the picture leaves. (It used to end with the picture's top near the top of the screen, over half a screen; the end was cut off as soon as you scrolled on.) Scrolling back runs it backwards, eased over about 120 ms. The mouse does nothing to it (it did at first; you preferred the scroll). It reads where the page is, never the wheel, and never moves the page. The video loads when its section is near; until it can be played, and for anyone who asked for less motion or less data, the first frame is shown as a still.
- **Finale:** a stage as tall as the screen (or as the scene, on a phone), then Nevo's place, then the Meet Nevo text.
- **Last section, and the end of the page** (`FinalCta.astro`, `src/scripts/night.ts`), copied from the end of lemonade.com/life: "Nevo’s brain never sleeps" and the MCP URL, standing on the faded top edge of his room (the room is pulled up behind them by 12% of its height, so nothing in it is behind the words: half, then 30%, put them over his head), the room as wide as the page (84 rem at most). There is no footer: the page ends with the room. It is one movie in four clips, each starting on the frame another ends on, so no cut shows: **awake** (a loop: the lamp on, Nevo awake in bed looking about, his brain typing at the laptop); **sleep** (he yawns, closes his eyes, z’s float up, the lamp goes off, the room is dark but for the laptop’s pink glow); **night** (a loop: he sleeps, the brain keeps typing); **wake** (sleep played backwards: the lamp comes on, he opens his eyes). He falls asleep when you reach the very bottom (the room all on screen); he wakes when you scroll back up a little (12% of the window) from the furthest down you went, with the room in view, and falls asleep again if you scroll down to the bottom again. Nothing is ever left half-way: if the room leaves the screen in the middle of a change (a flick), the page takes the colours of where you are at once, and the room shows him awake or asleep to match, or the change if you come back in time to see it. (The first version waited until the room was nearly off the screen to wake him, and froze a change half-way when the room left the screen, so scrolling back up from the very bottom left the page dark.) The page darkens with the room, frame by frame (the darkness of every frame of sleep was measured when it was made, `night-sleep.json`): the section and the page past its end take the room’s paper colour, down to the page’s dark (`--dark`), the whole page above it goes dark with it (a layer of the page’s dark over it, as dark as the room), and the headline turns white. With the lights on, the card with the line to copy stands off the white room on a deep shadow; as it goes dark, the card glows pink, its light shining out from behind it. Cut to be quick (you asked: it took too long): sleep is entered at the start of the yawn (it opens with a smile that repeats the awake loop); the awake loop hands over only when he faces you, as he does there (`meets`, measured on his head), playing at 2× while he looks away, under a second; the yawn plays at 1.5× until the lights are off; wake is entered just after the lights went off, so the lamp comes on at once, and so is a turn-round in the dark. Measured: 1.3 to 2.1 s from reaching the bottom to dark, about 0.4 s from scrolling up to the lamp on. Changing your mind half-way swaps sleep and wake at the same frame. Under 900 px the words stand above the room instead of on it, and the room keeps 13 rem of height and loses its far ends. With less motion: the two stills, lights off and on at once; with Save-Data, the stills fade. The four clips (1.5 MB) load when the room is a screen away.

### 6.3 Finale storyboard

| Step | When | What happens |
|---|---|---|
| Arrive | The stage comes up from the bottom of the screen | The brain, smaller, with the four ability objects round it, their names under them |
| Gather | Still coming up, until its middle meets the screen's | Each object flies into the brain and lights its part pink; the brain grows big |
| Landing | From there, over the first two thirds of the scrolling it takes the page to bring Nevo to the middle of the screen (about 470 px at 1440×900) | The brain is held in the middle of the screen while the page brings Nevo up. He looks up, eyes wide, mouth round. The top of his head opens, the brain drops in, the lid shuts, his head dips, he shakes it into place (left, right, left: this is where the head reads as round). A smile, the four abilities come back out round his head, "Nevo's brain", and one wink |
| Rest | The last third | Nothing more happens: it is all done while he is still low (his face, the abilities and the label on screen, his shoulders not yet), and the page brings him up to the middle, whole. The label is still on screen a fifth of a screen past the end, so you see him finished before he scrolls away. At first it ended exactly as he reached the middle, and he was cut off by the time you had seen it all; then at four fifths; you asked for faster again. Much sooner and his face is below the screen as the brain drops in |

**Nevo's rig.** The traced portrait is cut into layers (`art/scripts/rig_bust.py`): shoulders that stay put, a head that turns on the neck, and a face whose features slide across the head as it turns, nose further than the eyes, all clipped to the skin so a feature sliding toward the edge goes behind it. He breathes, blinks, glances about, and turns toward the mouse pointer (a mouse only; a finger on a phone is scrolling).

### 6.4 How the brain is drawn

A real 3D model, in plain WebGL (`src/brain/three/`).

- **Folds:** grown, not written as a formula. `art/scripts/bake-folds.mjs` grows a Turing pattern on the brain's actual shape (winding ridges of even width that fork and stop), mirror-symmetric so a groove runs down the middle, and stores it as one byte per vertex (14 KB). The mesh is raised along the folds and the ink is drawn along the grooves.
- **Shape:** an egg a little flattened underneath, with a fissure between the hemispheres, a small cerebellum tucked under the back and a short stem.
- **Style:** an outline pass and a fill pass. White with one grey shadow tone taken from the smooth shape, so there is no embossing. Lit lobes are a pale pink wash with pink fold lines.
- **One canvas per place:** the hero's brain, and the finale's brain and four objects. The models are built once for both.

`/lab/models`, `/lab/brain`, `/lab/icons` and `/lab/big` show the models from several angles, in development only.

### 6.5 Narrow screens and reduced motion

- Under 1100 px the story is one column; nothing changes in how it works. Under 900 px the hero's scenes are hidden.
- `prefers-reduced-motion`: no spin, no videos (the stills stay: Nevo's scenes show their first frame; the night room is two stills, lit and dark), the lights at the bottom go off and on at once, no radar sweep, no breathing, blinking or looking about, and each finale step is simply on or off at its halfway point.
- The drawings and the stage are decorative (`aria-hidden`). Everything they show is also in the text.

## 7. Proof: Stripe-style charts

Modelled on your Stripe profile card, redrawn in the site's style: charcoal text, hairline grid, pink line, axis labels on the right. Drawn as SVG at build time; a crosshair and tooltip snap to the nearest month (mouse, touch or arrow keys); the same numbers are in a table underneath. Every card links to Stripe.

**Data.** Read off the Stripe screenshot you sent (`reference/stripe-mrr-2026-09-30.png`). Month-start values, rounded to $500, good to about ±$1,300; the last point is the exact figure on the card. In `src/data/mrr.json`.

**The headline number.** $229,846 MRR is $2.76M ARR. $3M ARR is $250k MRR. See D1.

## 8. Art

| Thing | How it is made | Status |
|---|---|---|
| Brain and the four ability objects | 3D models built in code | Done |
| Brain's still image (first paint, no-WebGL fallback) | One frame from the hero canvas: `node tests/capture-still.mjs` | Done |
| Nevo's portrait | Redrawn (Oct 2026) from a front-facing photo (`reference/nevo-photo-2.png`, pick `v2_3`), traced with Vectorizer.AI keeping five greys, checked against the drawing (`trace_bust.py`: mean error 1.5/255, beard 6.5), cut into a rig | Done |
| Hero scenes (lab, rocket) | Image model with Lemonade crops as style reference, small things near the brain removed, pink added, then a Seedance loop | Done |
| Nevo's four scenes | Image model: a sheet of Nevo drawn from your photo, then a first and a last key frame per scene with the brain in it; Seedance animates from one to the other | Done |
| The night room (last section) | Image model, from the sheet: the room with him asleep and the lamp on. Everything after that is Seedance, each clip referencing the frames of the others: the lights going off (its last frame is the night, N), him waking (its last frame is him awake, A), a loop on A, A to N, a loop on N | Done |
| Charts | Coded SVG | Done |
| Small brain mark (favicon), social image | | To do |

**The drawings' pipeline** (`art/scripts/`):

1. `scenery.py`: generates candidates with the image edit endpoint, a crop of Lemonade's hero as the style reference (in `reference/`, not shipped). Each prompt is saved next to its images.
2. `scenery_clear.py`: takes things out of a pick (the hero's two had small robots near the brain).
3. `scenery_pink.py`: the one touch of pink, done by the image model with the drawing as reference and the spot named.
4. `nevo_acts.py sheet | first | last | before`: Nevo's scenes. `sheet` draws him from your photo (`reference/nevo-photo-1.png`) in the site's lines; every scene is then drawn from the photo, the chosen sheet, the Lemonade style crop and the site's brain, with his features spelled out in the prompt. `first` draws a scene's opening key frame, `last` its closing one from the chosen first, and `before` an opening one drawn back from a closing one.
5. `night_room.py light | dark`: the last section's room, lit (`dark`, the image model's own night version, is unused: it moved everything about, so a crossfade showed double lines). Then only Seedance, from that one drawing (`scenery_video.py`, the `night-*` scenes): `night-out` (lights off) and `night-wake` (him waking) are made only for their last frames, the night and him awake; `night-awake` loops on the one, `night-loop` on the other, and `night-sleep` goes from one to the other (and is written backwards too, for waking). `finish` greys every colour but the pink (Seedance tinted the night blue), sets each frame's paper on the page's colour for its darkness, and writes the darkness curve and where the awake loop meets the sleep. Where the clips meet, their frames differ by 1.6 to 3.5 levels out of 255 on average, which the page's 0.18 s cross-fade hides.
6. `scenery_video.py frame | still | animate | finish`: sets each drawing on a 16:9 frame (a scene's two key frames trimmed to the same box, so they line up), writes the stills the page shows, has Seedance 2.0 animate each (a loop gets the same picture as first and last frame), and trims and whitens the result. A paid task is remembered, so running it again never buys twice.

**The loops.** Each is 5 seconds at 24 fps, made at 1080p and trimmed to its drawing: 260 to 540 KB each, loaded only when on screen. The first and last frames match (checked: 0 to 8 pixels differ), so they loop without a jump. To remake one after changing its drawing: `python3 art/scripts/scenery_video.py frame <name> && … animate <name> && … finish <name>` (about $2.50 each at 1080p). The grey loops made before the pink was added are kept in `art/video/grey/`, unused.

**Nevo's scenes.** Made at 1080p, 5 seconds, and encoded so the scroll can move them to any moment: 1120 px wide, a keyframe every 8 frames, 0.3 to 1.2 MB each. The kick is over in its first 3 seconds, so the video is cut to that (`span`), and the whole scroll is the kick. It was remade (Oct 2026, $4.96 for two takes): given the cheering last frame, Seedance cut to it mid-flight instead of moving there, twice; it now gets only the first frame and words asking for one continuous shot. What was learned making them:

- Likeness: the first drafts were drawn from the finale's traced bust and didn't look like you. Drawing from the photo, through a sheet made from it, with the features named (swept-back hair with short sides, thick straight brows, jaw beard, full lips, broad jaw), and drawing you big, fixed it.
- Asked for a closing frame that needs more room (a plant growing tall), the image model shrinks the whole scene. Drawing the opening frame back from the closing one (`before`) keeps the size.
- Seedance follows any trail drawn in the last frame: a dashed line that started at the whiteboard sent the brain there first. The closing frames have nothing drawn in the air.
- The image model puts radar arcs on the right of whatever emits them; the scan scene is laid out so that reads right.

**Spent on art:** about 125 image generations; Seedance about $52.60 (the night room's five clips, $12.40, one of them for a single lights-off clip the page no longer shows; the six loops, $14.90, plus $2.50 to remake the rocket's, whose first version put the smoke on the satellite dish; before that a 480p test and three grey loops, all replaced; then Nevo's four scenes, $9.90, plus $2.50 for a first surfing scene with the old likeness and $2.50 for a kick that went the wrong way); 3 Vectorizer credits (the portrait, and a first vector version of the scenery that was dropped).

## 9. Tech

| | Choice |
|---|---|
| Framework | Astro 7, static output, TypeScript, pnpm |
| Styling | Scoped CSS, tokens in custom properties, sizes in rem |
| Timeline | GSAP core only, one paused timeline set with `timeline.time(t)`; ScrollTrigger is not installed |
| 3D | Raw WebGL 1, two shaders |
| Drawings | WebP stills and short H.264 videos: loops in the hero, Nevo's scenes played by the scroll. Loaded only near the screen, not at all with reduced motion or Save-Data |
| Charts | SVG generated at build time |
| Fonts | Merriweather 400, Lato 400/700, Caveat 700, self-hosted |
| Hosting | Railway, as in Railway's own Astro template: `railway.json` picks its Railpack builder, which installs with pnpm 10.7.0 (`packageManager`) on Node 22 (`engines`), runs `pnpm build`, and serves `dist/` with Caddy on Railway's port (byte ranges included, which the videos need for seeking). No start script: one would turn the static serving off. `.railwayignore` keeps `art/` (195 MB) and `reference/` (your photo) out of `railway up`, which uploads 6.8 MB |

```
nevomd/
├─ PLAN.md
├─ reference/                your inputs and the Lemonade style crops  (not shipped)
├─ src/
│  ├─ pages/index.astro, lab/[view].astro (dev only)
│  ├─ content/site.ts        every string, number, link and install name
│  ├─ components/            Story, Hero, InstallQuick, Stage, AbilityChapter, AbilityProof,
│  │                         AskCard, MeetNevo, Proof, MrrChart, HowItWorks, InstallPanel,
│  │                         CommandBox, Faq, FinalCta, NevoAct
│  │  └─ panels/             NicheRadar, HypeWaves, TacticsBoard, GrowthResult
│  ├─ brain/                 hero.ts (hero canvas), stage.ts (finale loop), scroll-progress.ts,
│  │  │                      story-timeline.ts, layout.ts
│  │  └─ three/              geometry.ts, brain-shape.ts, folds.ts (baked), models.ts, renderer.ts
│  ├─ scripts/               install-panel.ts, scenery.ts (plays the loops), nevo-acts.ts (Nevo's
│  │                         scenes, played by the scroll), night.ts (lights out), chart-hover.ts
│  └─ assets/                art/ (brain still, portrait rig), scenery/ (drawings and videos)
├─ art/                      raw/, prepared/, traced/, video/, scripts/  (not shipped)
└─ tests/                    scroll-rules.spec.ts, install.spec.ts, nevo-acts.spec.ts, hero-brain.spec.ts,
                             night.spec.ts, shots.mjs, capture-still.mjs
```

**Commands:** `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm preview` (the built site, locally), deploy: `railway init` once, then `railway up`, and `railway domain` for a public address, `node tests/shots.mjs <folder>` (screenshots of every step; `--mobile`, `--size=2560x1328`), `node tests/capture-still.mjs`, `node art/scripts/bake-folds.mjs`.

**Tests (Playwright, using the installed Chrome):** the wheel scrolls exactly as far as it is turned; no wheel listeners, no blocking touch listeners, no scroll-snap or smooth scrolling; text moves one pixel per pixel scrolled; the story's rows are contiguous and none is empty, nothing fixed or pin-spaced; something moves with the page at every point, at six window sizes; the finale is the same whether you jump there or scroll there, and returns to its opening pose; when it has played out, Nevo's face and the label are on screen, and still are a fifth of a screen later, and he is whole once the page has brought him up (four window sizes); reduced motion stops the timers, and without it the brain spins (compared with a tolerance of 8 levels, since a faded edge composites a level differently from paint to paint); the hero has nothing above the headline and no button but Copy; the hero and the end show the MCP URL alone, it copies, and there are no instructions and no skill command anywhere; every MCP command in the full panel is built from the one name and URL; the agent chosen there is remembered; each of Nevo's scenes is where the scroll says, both ways, plays over about a third of a screen, and has played out with its picture whole on screen; the mouse does nothing to it, and it stays a still with reduced motion; dragging the hero's brain with a mouse turns and tips it without scrolling the page, it sits back up when let go, and a flick coasts; on a phone, swipes over it (sideways, up, diagonal) scroll the page and never turn it; the last section says the brain never sleeps; scrolled with the wheel: down to the end he falls asleep through the clips in order, the lights off within 3.5 s, the section and the whole page above it the page's dark, and nothing comes after the room; a jiggle leaves him asleep; back up a little he wakes and the page is light within 1.5 s; down again, asleep; one flick back up from the bottom leaves the page light; on a phone it ends dark and he wakes on the way back up; changing your mind half-way turns the movie round; with reduced motion, two stills and no video loaded; the launch check (skipped while the names are mocks).

## 10. What is done and what is left

| | Status |
|---|---|
| Page structure, all sections, draft copy | Done |
| Hero with the MCP URL, 3D brain (it can be dragged) and scenes | Done |
| Ability sections: text, a picture of its own, Nevo with the brain, played by the scroll | Done |
| Finale: brain into Nevo's head, Nevo acting | Done |
| Tests for the scroll rules and the install blocks | Done, passing |
| Hero loops, Nevo's four scenes | Done |
| Last section: "Nevo’s brain never sleeps" on his room, lights out, the end of the page | Done |
| Your review: the copy, the facts | Next |
| Real install names, fresh Stripe link | Needs you |
| Launch work: favicon and social image, font subsetting, JSON-LD, `/llms.txt`, sitemap, DataFast, a real iPhone and Safari pass, deploy | To do |

## 11. Decisions

**Decided:**
- The CTA is the line to copy, the MCP server's URL, in the hero and at the end, with no instructions; every agent's steps are in "How it works". No waitlist, no top bar, no menu, no logo, no footer, no other buttons.
- The brain and the ability objects are real 3D. The brain is in the hero and the finale only.
- The ability sections follow Lemonade: centered text, the drawing at the bottom of the section, bands alternating.
- That drawing is Nevo, in a different pose in each section and never the finale's bust, always doing something with the brain, and played by the scroll, like the finale (not the mouse). He has to look like you.
- Every drawing has one touch of pink, added by the image model.
- The finale: the brain takes in the four abilities and drops into Nevo's head; Nevo is animated.
- The MCP has no key. It signs users in with OAuth2 and their email, free. The names in the commands are mocks for now.

**Still open.** The build uses the default unless you say otherwise.

| | Decision | Default in the build |
|---|---|---|
| D1 | The headline number | "$2.7M ARR", computed from the MRR; it says "$3M" once MRR reaches $250k |
| D2 | H1 | "Your agent can build anything. Now teach it to sell." |
| D5 | Accent colour | Lemonade's `#FF0083`; one token to change |
| D6 | What the MCP does that the SKILL doesn't | The FAQ says the MCP always has the latest |
| D7 | Domain | `nevo.md` |

## 12. Needed from you

1. The copy. All of it is a draft, and the bio facts are from articles that are months old.
2. The real names for the commands before launch: MCP URL, server name.
3. A fresh Stripe proof link.

## 13. Risks and parked ideas

| Risk | Handling |
|---|---|
| A command on the page fails on launch day | Commands generated from one config, a launch check in the tests |
| The numbers go stale | One data file, an "as of" date, a link to the live proof |
| The 3D is heavy on an old phone | Buffers capped at 2x; loops stop off screen. Not yet measured on a real low-end phone |
| iOS Safari | `svh` units, sizes measured on resize and never on scroll. Not yet tested on a real iPhone |
| Nevo's scenes on a phone | About 3.3 MB of video for the four, each loaded only near the screen. Seeking a video on scroll is not yet tested on a real iPhone |

Parked: playbook pages on the site; a live MRR figure from Stripe; an "ask the brain one question" box.

## Appendix A. Source articles

| Date | Title | Views |
|---|---|---|
| 21 Aug 2026 | How I would pick a startup idea in 2026 (after taking Postiz to $2M ARR) | 21.9K |
| 10 Aug 2026 | Postiz crossed $2M ARR while everybody says SaaS is dead | 206.4K |
| 15 May 2026 | Postiz Reached $100k MRR | 78.9K |
| 1 Apr 2026 | Paperclip runs my marketing, it feels ILLEGAL | 543.6K |
| 5 Mar 2026 | If I wanted to go from $0 to $250k in 12 months, here's what I'd do | 30.2K |
| 14 Feb 2026 | How I reached 20k MRR with my Social Media Scheduler Postiz (Full Playbook) | 12.7K |
| 30 Jan 2026 | How I increased Postiz's monthly revenue from $15k to $18k (no extra traffic) | 928 |
| 13 Jan 2026 | I finally took my social media scheduler to the next level ($15k → $17k) | 720 |
