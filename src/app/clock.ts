import type Lenis from "lenis";

/**
 * One requestAnimationFrame for the whole page. Each frame the smooth scroll advances first, then
 * everything that reads scroll position (the hero, the background field) draws from that same value,
 * so nothing lags or jitters against anything else.
 */
type Tick = (time: number) => void;

const ticks = new Set<Tick>();
let lenis: Lenis | null = null;
let raf = 0;

function frame(time: number) {
  lenis?.raf(time);
  ticks.forEach((t) => t(time));
  raf = ticks.size > 0 || lenis ? requestAnimationFrame(frame) : 0;
}

function start() {
  if (!raf) raf = requestAnimationFrame(frame);
}

/** Run `tick` every frame, after the scroll has advanced. Returns a function that stops it. */
export function addTick(tick: Tick) {
  ticks.add(tick);
  start();
  return () => {
    ticks.delete(tick);
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
