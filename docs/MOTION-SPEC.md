# Kebiki motion specification

Engineering spec for taking kebiki.studio's scroll and animation to the standard of lenis.dev.

- **Written:** 4 October 2026
- **Reference:** `~/Code/libraries/lenis-dev-analysis.md` (the lenis.dev teardown, 2 October 2026)
- **Audited code:** `~/Code/kebiki-motion` at commit `cce458f`, plus uncommitted phone styles
- **Status:** WP1 and WP2 are built (4 October 2026). WP3 is built (5 October 2026): decision D2 was "scroll-driven". WP5 is closed by the same change: the phone scroll stop existed only to protect a timed animation, so it is removed and D3 no longer applies. WP4 and WP6 to WP9 are not started.
- **WP3 as built:** the sentence settles over 70 viewport-heights of scroll after it appears (`SETTLE_VH`), on a 280vh track at every width (`TRACK_VH`). The waiting Japanese characters are chosen by a hash of word, slot and step, so the same scroll position always draws the same frame. No timers remain in the sentence animation.
- **Measured for WP1 and WP2** (scripted sweep of 81 scroll positions, 1,620 frames, 1160 px wide, comparing before and after): frame callbacks per frame went from 2.3 on average and 8 at worst to exactly 1; layout reads inside frames went from several per scroll frame to 0; the rendered output was identical at every position. A Chrome performance trace and real-device testing have not been done.

## 1. Summary

The teardown found three separable layers behind the lenis.dev feel: a smooth scroll engine, one frame clock shared by everything that draws, and restrained scroll-driven choreography on top.

Kebiki already has the first layer and half of the second. Lenis 1.3.26 is installed and running, a shared clock exists (`clock.ts`), and the hero and background field draw from it. The gap is that five other animations still run outside that clock on their own scroll listeners, and several read layout inside the frame. That is the difference between "smooth scrolling" and "everything lands on the same frame".

So this is a consolidation job, not a rebuild. No new library is needed. The work is nine packages, of which the first three deliver most of the visible gain.

## 2. The standard we are matching

From the teardown, the properties that produce the feel:

1. **One continuous scroll curve.** Wheel input is intercepted, normalised, and the real scroll position chases a target with frame-rate-independent damping.
2. **The real scroll position moves.** No transforms on the page content, so `position: sticky`, find-in-page and the scrollbar keep working.
3. **One `requestAnimationFrame` clock.** Scroll advances first, then everything that depends on scroll draws, in the same frame.
4. **Everything visual is a pure function of scroll position.** Same scroll position, same frame, every time.
5. **Very little moves at once.** One canvas, a few pinned blocks, one accent colour.
6. **Native behaviour is left alone.** Touch scrolling stays native, pinch-zoom is ignored, inner scrollers opt out, reduced motion is honoured.

## 3. Where the site is today

### 3.1 Already at the standard

| Property | Evidence |
|---|---|
| Lenis running, same version as the saved reference copy (1.3.26) | `motion-home.tsx:793` |
| Driven externally, not by Lenis's own loop | `setLenis(lenis)` into `clock.ts` |
| Shared clock: scroll advances, then subscribers draw | `clock.ts` `frame()` |
| Hero and background field draw on that clock | `addTick` at `motion-home.tsx:1099`, `scroll-field.tsx:99` |
| Touch scrolling left native | `syncTouch: false` |
| Pinned scenes built from a tall track and a sticky stage, no ScrollTrigger | `.k-track`, `.k-roller-track` |
| Progress bar uses `transform: scaleX` | `.k-progress` |
| Disciplined `will-change` (2 uses; lenis.dev has 12) | `motion.css:213`, `:766` |
| Reduced motion handled in every animated component | throughout |

### 3.2 Gaps

| # | Gap | Evidence | Effect |
|---|---|---|---|
| G1 | Five animations run outside the shared clock, each with its own scroll listener and its own `requestAnimationFrame` | Project roller (`motion-home.tsx:209-245`), progress bar (`:801-818`), stage highlight (`:826-855`), three dot maps (`dot-map.tsx:261-366`) | They update a frame after the hero does. This is the main source of anything that reads as lag or drift between elements. |
| G2 | The hero reads its scroll position from a `scroll` event, then draws on the clock | `readScroll`, `motion-home.tsx:939-949` | Probably draws from a value one frame old. Inferred from the event order; confirm with a performance trace before fixing. |
| G3 | Layout is measured inside the frame | `getBoundingClientRect` at `:224`, `:837`, `:933`, `:940`; `dot-map.tsx:279` | Forces the browser to recalculate layout on every scroll frame. |
| G4 | The Japanese sentence animation reads and writes layout per word, per frame | `getComputedStyle` and `offsetWidth` at `:1075-1076`, interleaved with text writes | Up to 18 forced layouts a frame for 3.4 seconds. Added on 4 October; it works but is the least efficient code on the page. |
| G5 | The sentence animation is timed, not scroll-driven | `SHUFFLE_MS = 3400`, started when scroll crosses a threshold | Breaks property 4. It is why the phone view needed a hold added: the reader can scroll past before it finishes. |
| G6 | The phone hold uses a CSS scroll-snap stop on the root element | `.k-track-stop`, `motion.css` | Added on 4 October and not tested on a real device. Root-level snap is the kind of native-scroll interference the teardown warns against. |
| G7 | All viewport heights use `vh` (47 uses), none use `svh`, `lvh` or `dvh` | `motion.css` | On phones `vh` is the tall viewport, so sticky stages are taller than the visible screen while the address bar shows. |
| G8 | No Lenis lifecycle handling | No `lenis.stop()`, `data-lenis-prevent` or visibility handling anywhere | Harmless today because there are no overlays or inner scrollers. Becomes a bug the day a menu or modal is added. |
| G9 | Two transitions animate properties other than `transform` and `opacity` | `grid-template-rows` (`motion.css:1621`), `fill` (`:63`) | `grid-template-rows` triggers layout on every frame of the transition. |
| G10 | One 1,394-line component holds every scene and eight effects | `motion-home.tsx` | Not a performance problem. It is why each of the gaps above was easy to introduce. |

### 3.3 Scroll feel: a tuning difference, not a defect

| Setting | lenis.dev (defaults, not measured) | Kebiki |
|---|---|---|
| `lerp` | 0.1 | 0.08 |
| `wheelMultiplier` | 1 | 0.8 |
| Time constant | about 170 ms | about 210 ms |
| 95% settled | about 0.5 s | about 0.6 s |

Kebiki scrolls a little heavier and slower than the reference. The teardown could not read the live site's actual options, so the reference figures are Lenis defaults. See decision D1.

## 4. Target architecture

### 4.1 Frame contract

Every frame runs three phases, in this order, from the one loop in `clock.ts`:

1. **Advance.** `lenis.raf(time)`.
2. **Read.** Build one `FrameState` object. No component reads the DOM for scroll position after this point.
3. **Write.** Each registered scene's `update(state)` runs. Scenes write styles only.

```ts
type FrameState = {
  time: number;        // ms, from requestAnimationFrame
  dt: number;          // ms since the previous frame
  scroll: number;      // px. lenis.scroll on wheel devices, window.scrollY on touch
  velocity: number;    // px per frame
  limit: number;       // max scroll, cached
  vw: number;          // viewport size, cached
  vh: number;
};
```

### 4.2 Scene interface

```ts
type Scene = {
  /** Read layout. Called on mount, resize, font load and content change. Never per frame. */
  measure(): void;
  /** Write styles from state. No layout reads. */
  update(state: FrameState): void;
  dispose(): void;
};
```

`clock.ts` gains `addScene(scene)`. It calls `measure()` on every scene from a single debounced `ResizeObserver` on the document, and after `document.fonts.ready`.

### 4.3 Geometry cache

Each scene stores its own `top` and `height` in document coordinates during `measure()`:

```ts
top = el.getBoundingClientRect().top + window.scrollY;
height = el.offsetHeight;
```

Progress through a pinned scene is then arithmetic, with no DOM read:

```ts
progress = clamp01((state.scroll - top) / (height - state.vh));
```

### 4.4 Rules

- Animate only `transform` and `opacity`. Colour changes on hover are exempt.
- No transforms on scrolling content.
- No `getBoundingClientRect`, `offsetWidth`, `offsetHeight` or `getComputedStyle` inside `update()`.
- A scene whose element is off screen returns early from `update()`. Visibility comes from the cached geometry, not an `IntersectionObserver` per component.
- Every scene has a reduced-motion path that leaves the content readable and static.

## 5. Work packages

Ordered by value. Each can ship on its own.

### WP1. Put every animation on the one clock (fixes G1, G2)

- Convert the project roller, progress bar, stage highlight and hero scroll read into scenes registered with `addScene`.
- Remove their four `scroll` listeners and four private `requestAnimationFrame` calls.
- Dot maps: keep their private physics loop, since it only runs while the pointer is near, but take the pointer-on-scroll update from `FrameState`.
- **Done when:** a search for `addEventListener("scroll"` in `src/app` returns nothing, and a performance trace shows one animation-frame callback per frame during scroll.

### WP2. Geometry cache (fixes G3)

- Implement 4.3 for the hero track, roller track, stage rows and contact section.
- **Done when:** a trace of a continuous scroll shows no "Recalculate style" or "Layout" entries caused by script inside the frame callback.

### WP3. Sentence animation (fixes G4, decides G5)

- Measure each word's width and the font size once, when the animation starts and on resize. Store glyph counts per word.
- Per frame, write text only.
- Decide D2 before building: keep it timed, or drive it from scroll.
- **Done when:** no layout reads occur during the animation, and it looks identical to the current version at 390 px and 1440 px.

### WP4. Phone viewport units (fixes G7)

- Sticky stages: `height: 100svh`. Tracks: keep a multiple of `lvh` so scroll distance does not change as the address bar hides.
- Update `TRACK_VH` and `PLAY_VH` to read the measured track height, not assumed units.
- **Done when:** on iOS Safari and Android Chrome, no pinned stage is cut off by the address bar and nothing jumps as it hides.

### WP5. Phone hold on the orange screen (resolves G6)

- Test the current CSS snap stop on real devices first. It may be fine.
- If it interferes with scrolling anywhere else on the page, remove it and rely on the longer track alone, or replace it with the `lenis/snap` package, which is in the saved reference copy.
- **Done when:** D3 is decided on a real phone, and a flick from the logo lands on the settled sentence without the page feeling sticky elsewhere.

### WP6. Lenis lifecycle (fixes G8)

- Expose `stopScroll()` and `startScroll()` from `clock.ts`, for any future menu or modal.
- Document `data-lenis-prevent` for inner scrollers.
- Pause the clock on `visibilitychange` when the tab is hidden.
- **Done when:** the clock makes no frame callbacks while the tab is in the background.

### WP7. Property discipline (fixes G9)

- Replace the `grid-template-rows` transition with a `transform` or `clip-path` reveal, or accept it if it only runs on a click.
- **Done when:** every `transition` in `motion.css` lists only `transform`, `opacity`, colour properties, or carries a comment saying why it is exempt.

### WP8. Split the page into scenes (fixes G10)

- One file per scene under `src/app/scenes/`: hero, sentence, engagement, roller, team, contact. Copy stays in data files.
- `motion-home.tsx` becomes composition only.
- **Done when:** no file under `src/app` exceeds about 400 lines and each scene's animation code sits beside its markup.

### WP9. Optional layers from the reference: recommend against

lenis.dev also has a WebGL scene and a custom cursor. The teardown is explicit that each layer copies separately.

- **WebGL scene:** not recommended. Kebiki's background field is a 2D canvas already on the shared clock, which is the part that matters. A 3D scene adds weight and nothing to the message.
- **Custom cursor:** not recommended. It works against property 6 and adds a moving element for no informational gain.

## 6. Budgets

| Measure | Budget | How to check |
|---|---|---|
| Script time per frame during scroll | under 4 ms on a mid-range laptop, under 8 ms on a mid-range phone | Chrome performance trace |
| Forced layouts per frame | 0 | Same trace, "Layout" entries with a script cause |
| Animation-frame callbacks per frame | 1 | Same trace |
| Layout shift after load | 0 | Lighthouse CLS |
| JavaScript added by this work | 0 kB, since no new dependency is needed | Build output |

These are targets I am proposing. None has been measured against the current site yet; step one of WP1 is to record a baseline trace so the improvement is provable.

## 7. Test plan

A desktop browser cannot reproduce finger-flick scrolling, so real devices are required.

| Device | Browser | Checks |
|---|---|---|
| iPhone, current iOS | Safari | Flick through hero, hold on sentence, roller, address bar show and hide |
| Android phone | Chrome | Same |
| MacBook | Chrome, Safari | Trackpad and mouse wheel feel alike; trace against the budgets |
| Windows laptop | Chrome or Edge | Notched mouse wheel |
| Any | Reduced motion on | Every section readable and static |

Manual script for each: load, scroll slowly to the end, scroll fast to the end, scroll back up, resize or rotate, use find-in-page, use an in-page anchor link.

## 8. Decisions needed

- **D1. Scroll weight.** Keep `lerp 0.08` and `wheelMultiplier 0.8`, or move to the reference's `0.1` and `1`. This is a feel judgement, best made by trying both on the live site for a day each.
- **D2. Sentence animation.** Keep it timed with a hold, or make it scroll-driven so it can never be skipped and needs no hold. Scroll-driven is truer to the reference. Timed is what is live.
- **D3. Phone hold.** Keep the CSS snap stop, remove it, or replace it with `lenis/snap`. Decide after WP5's device test.

## 9. Out of scope

- Copy and layout changes.
- New sections or effects.
- Moving to Lenis 2.0, which is still a development line. The reference site runs `2.0.0-dev.5`; nothing in this spec needs it.

## 10. Suggested order

1. Baseline trace, then WP1 and WP2 together. This is the bulk of the gain.
2. WP3, after D2.
3. WP4 and WP5, tested on real phones in one session.
4. WP6 and WP7. Small.
5. WP8 last, as a refactor with no behaviour change, so it can be reviewed against a site that already works.

## 11. Work list films (added 9 Oct 2026)

Pepay, DRK and BNBPay each carry a film: a silent recording of the product. Timings live in `FILM_SHOW` in `src/app/motion-home.tsx`.

| # | Requirement |
|---|---|
| 1 | **Play on arrival.** The film plays muted in its corner tile from the moment its project is at the front of the roller, and only while the roller is on screen. |
| 2 | **Trigger.** `dwell` ms after scrolling stops on the project (movement under 2px counts as still), provided the film is playing. Once per arrival: leaving the project and returning re-arms it. |
| 3 | **Motion.** The tile's own rectangle travels from the corner toward the middle and grows in the same movement, over `travel` ms, slow in and slow out. Crop and corner radius change continuously; no cut, no fade. |
| 4 | **Resting state.** 92% of the screen width, centred slightly below the middle so the project name stays visible, lifted by a soft shadow. |
| 5 | **No backdrop.** Nothing is dimmed. The page stays visible and scrollable behind the film. |
| 6 | **No player chrome.** No native controls. The one control is a small persimmon cross on a dark glass disc in the film's top right corner, with a 44px touch area. |
| 7 | **Return.** The film travels back into its tile, at the same moment in the recording, at the cross, a tap outside it, a scroll of `release` px, Escape, or after playing through once (`longest` seconds at most). |
| 8 | **Manual open.** Tapping the tile does the same immediately and suppresses the automatic one for that arrival. |
| 9 | **Layering.** Rendered in the top layer (Popover API, `popover="manual"`), above the header button, without making the page inert. |
| 10 | **Accessibility.** With reduced motion there is no automatic opening and no travel. The cross is a labelled button; a manual open moves focus to it and closing returns focus to the tile. |
| 11 | **Autoplay refused.** A phone that will not start the film does not open it automatically; the visitor's first tap anywhere starts it. |
| 12 | **One element per film.** The video element playing in the tile is the one that presents itself: it is moved into the travelling frame and moved back, each within a single task, so playback never stops and no second element has to ask the phone for leave to start (a phone saving power refuses, and shows its own play button). While it is out, the roller's play and pause logic leaves the films alone. |

Per 4.4 only `transform`, `opacity` and a crop (`clip-path`) animate: the stage is laid out once at its resting place and travels by transform; the frame inside is cut to the tile's shape and corners at the start of the journey, which is what lets a 4:3 film leave a 16:9 tile without distortion. The shadow is a separate layer so the crop does not clip it.

## 12. Work roller hold (added 9 Oct 2026)

Arriving on a project should feel like stopping on it. The page scrolls natively on phones, and slowing the finger would mean taking over touch scrolling, so the hold lives in how scroll maps to the drum (`ROLLER` in `src/app/motion-home.tsx`), not in the scroll itself.

| # | Requirement |
|---|---|
| 1 | **Hold zone.** Each project owns a stretch of scroll in which the drum does not turn: `hold` x `perItem` screens (0.33 of a screen). |
| 2 | **Travel.** Between holds the drum turns to the next project over the rest of `perItem` (0.27 of a screen), eased in and out. |
| 3 | **First and last.** The first project holds from the moment the stage sticks; the last holds until it lets go. The track is `100 + (projects - 1 + hold) x perItem x 100` vh. |
| 4 | **No hijacking.** Native scrolling and momentum are untouched; a fast flick still passes several projects. |
| 5 | **Unchanged.** The reduced-motion list, the film trigger (section 11), and smooth scrolling on desktop. |
