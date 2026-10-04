import type Lenis from "lenis";

/**
 * One requestAnimationFrame for the whole page, in three phases:
 *
 *   1. advance  the smooth scroll moves (Lenis, where it runs)
 *   2. read     one FrameState is built; if the layout has changed, every scene re-measures first
 *   3. write    every scene updates from that state
 *
 * Scenes read layout only in measure(), never in update(), so a scrolling frame does no layout work
 * and everything on the page draws from the same scroll position in the same frame.
 */
export type FrameState = {
  /** The frame's timestamp, ms (from requestAnimationFrame). */
  time: number;
  /** ms since the previous frame, capped so a background tab does not produce one huge step. */
  dt: number;
  /** Scroll position, px: Lenis's where it runs, the window's otherwise. */
  scroll: number;
  /** Scroll movement this frame, px. */
  velocity: number;
  /** The furthest the page can scroll, px. */
  limit: number;
  /** Viewport size, px. */
  vw: number;
  vh: number;
};

export type Scene = {
  /** Read layout and cache it. Runs on mount, resize, font load and content resize; never per frame. */
  measure(): void;
  /** Write styles from the frame's state. No layout reads. */
  update(state: FrameState): void;
};

const scenes = new Set<Scene>();
let lenis: Lenis | null = null;
let raf = 0;

const state: FrameState = { time: 0, dt: 0, scroll: 0, velocity: 0, limit: 0, vw: 0, vh: 0 };
let lastTime = 0;
let lastScroll = 0;
/** False until the first frame has run, so nothing reads a scroll position that was never set. */
let ran = false;
/** Set when the layout may have moved; the next frame re-measures before it draws. */
let stale = true;
let watching = false;
let contentWatcher: ResizeObserver | null = null;

const markStale = () => {
  stale = true;
};

function measureAll() {
  stale = false;
  state.vw = window.innerWidth;
  state.vh = window.innerHeight;
  state.limit = Math.max(0, document.documentElement.scrollHeight - state.vh);
  scenes.forEach((s) => s.measure());
}

function frame(time: number) {
  lenis?.raf(time);

  if (stale) measureAll();
  state.time = time;
  state.dt = lastTime ? Math.min(time - lastTime, 100) : 16.7;
  lastTime = time;
  state.scroll = lenis ? lenis.scroll : window.scrollY;
  state.velocity = ran ? state.scroll - lastScroll : 0;
  lastScroll = state.scroll;
  ran = true;

  scenes.forEach((s) => s.update(state));

  if (scenes.size > 0 || lenis) raf = requestAnimationFrame(frame);
  else stop();
}

/** One resize listener and one observer for the whole page: they only flag that a measure is due. */
function watch() {
  if (watching) return;
  watching = true;
  window.addEventListener("resize", markStale);
  contentWatcher = new ResizeObserver(markStale);
  contentWatcher.observe(document.documentElement);
  contentWatcher.observe(document.body);
  void document.fonts.ready.then(markStale);
}

function start() {
  watch();
  if (!raf) raf = requestAnimationFrame(frame);
}

function stop() {
  raf = 0;
  lastTime = 0;
  ran = false;
  if (!watching) return;
  watching = false;
  window.removeEventListener("resize", markStale);
  contentWatcher?.disconnect();
  contentWatcher = null;
}

/**
 * Register a scene. It is measured before its first update, and again whenever the layout changes.
 * Returns a function that removes it.
 */
export function addScene(scene: Scene) {
  scenes.add(scene);
  stale = true;
  start();
  return () => {
    scenes.delete(scene);
  };
}

/** Run `tick` every frame, for work that needs no layout. Returns a function that stops it. */
export function addTick(tick: (state: FrameState) => void) {
  const scene: Scene = { measure() {}, update: tick };
  scenes.add(scene); // nothing to measure, so the page's layout is not re-read on its account
  start();
  return () => {
    scenes.delete(scene);
  };
}

export function setLenis(instance: Lenis | null) {
  lenis = instance;
  if (instance) start();
}

/** Scroll speed in px per frame: from Lenis when it is running, otherwise 0. */
export function scrollVelocity() {
  return lenis ? lenis.velocity : 0;
}

/** The scroll position as the last frame saw it, for code that runs between frames (pointer events). */
export function lastFrameScroll() {
  return ran ? state.scroll : window.scrollY;
}

/**
 * An element's top edge in document coordinates, from its layout position. Unlike
 * getBoundingClientRect this ignores transforms, so a row that is mid-way through its reveal
 * measures where it will rest. Not for elements inside a sticky or fixed ancestor.
 */
export function documentTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    y += n.offsetTop + (n === el ? 0 : n.clientTop);
  }
  return y;
}
