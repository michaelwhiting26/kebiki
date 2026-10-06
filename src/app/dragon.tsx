"use client";

import { useEffect, useRef } from "react";

import { addScene, documentTop } from "./clock";
import { dragonField } from "./dragon-field";

/**
 * A dragon loose in the Contact section.
 *
 * It is a chain of points that follows the pointer (or wanders when there is none), with wings, and
 * it breathes fire now and then and on a click. It may go anywhere inside the section, and whatever
 * it passes moves out of its way and springs back: every letter of the section's text, each button
 * and link as one piece, and the dots of the map (through ./dragon-field). Letters caught in the fire
 * are knocked loose and settle.
 *
 * The text is split into one element per letter here, after the page has rendered: the real words
 * stay in place for screen readers, and pair kerning is put back so the split is not visible. The
 * dragon is drawn on one screen-sized canvas that never catches the pointer. Narrow screens and
 * visitors who ask for reduced motion get the page as it was.
 */

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Points along the spine, head first. */
const N = 38;
/** Clear space kept between the body and what it pushes, px. */
const PAD = 7;
const MAX_EMBERS = 420;
/** Below this viewport width there is no dragon. */
const MIN_WIDTH = 900;

const INK = "#0e0e10";
const PAPER = "#f8f5f0";
const PERSIMMON = "#fd540d";
const EMBER = ["#fff3dc", "#ffd23f", "#8c1a05"] as const;

/** Text that is split into letters, and things that move as one piece. */
const TEXT_TARGETS =
  ".k-contact-label, .k-contact-title, .k-contact-body, .k-contact-mail, .k-contact-lists dt, .k-tags li, .k-city-name, .k-city-note, .k-footer-note";
const BLOCK_TARGETS = ".k-cta, .k-cta-link, .k-copy, .k-city-time, .k-social a";

/** Body half-width along the spine (0 = head, 1 = tail tip), before scaling. */
const GIRTH: readonly [number, number][] = [
  [0, 8],
  [0.07, 7],
  [0.2, 14],
  [0.34, 16],
  [0.55, 10.5],
  [0.8, 4.6],
  [1, 0.8],
];
function girth(p: number) {
  for (let i = 1; i < GIRTH.length; i++) {
    const [p1, r1] = GIRTH[i];
    if (p <= p1) {
      const [p0, r0] = GIRTH[i - 1];
      return lerp(r0, r1, (p - p0) / (p1 - p0));
    }
  }
  return GIRTH[GIRTH.length - 1][1];
}

/** A fixed pseudo-random number in 0..1 for an index, so each letter always scatters the same way. */
function hash(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Circle = { x: number; y: number; r: number };

/** Something the dragon pushes: a letter, or a button moved whole. Positions are in section px. */
type Body = {
  el: HTMLElement;
  block: boolean;
  /** Rest centre and half-size. */
  hx: number;
  hy: number;
  hw: number;
  hh: number;
  /** Current offset from rest, and its velocity. */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  heat: number;
  /** Direction of the breath that last caught it. */
  fx: number;
  fy: number;
  seed: number;
  styled: boolean;
};

let kernCtx: CanvasRenderingContext2D | null = null;
const kernCache = new Map<string, number>();
/** Put pair kerning back between a word's letters, which separate inline boxes otherwise lose. */
function kern(word: HTMLElement) {
  const cs = getComputedStyle(word);
  if (/mono/i.test(cs.fontFamily)) return;
  kernCtx ??= document.createElement("canvas").getContext("2d");
  if (!kernCtx) return;
  const size = parseFloat(cs.fontSize) || 16;
  const font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
  kernCtx.font = font;
  const upper = cs.textTransform === "uppercase";
  const letters = word.children;
  for (let i = 1; i < letters.length; i++) {
    let a = letters[i - 1].textContent ?? "";
    let b = letters[i].textContent ?? "";
    if (upper) {
      a = a.toUpperCase();
      b = b.toUpperCase();
    }
    const key = `${font}|${a}${b}`;
    let d = kernCache.get(key);
    if (d === undefined) {
      d = (kernCtx.measureText(a + b).width - kernCtx.measureText(a).width - kernCtx.measureText(b).width) / 100;
      kernCache.set(key, d);
    }
    if (Math.abs(d * size) > 0.02) (letters[i] as HTMLElement).style.marginLeft = `${d.toFixed(4)}em`;
  }
}

/** Wrap every letter under `root` in its own element. Safe to call again: split text is skipped. */
function splitLetters(root: HTMLElement) {
  // Headlines are first split into lines elsewhere (and get their label for screen readers there).
  const lines = root.hasAttribute("data-lines");
  if (lines && !root.hasAttribute("data-split")) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (!t.nodeValue || !t.nodeValue.trim()) continue;
    if (t.parentElement?.closest(".k-dsplit, .k-sr, svg")) continue;
    found.push(t);
  }
  for (const t of found) {
    const text = t.nodeValue ?? "";
    const wrap = document.createElement("span");
    wrap.className = "k-dsplit";
    wrap.dataset.text = text;
    if (!lines) {
      const sr = document.createElement("span");
      sr.className = "k-sr";
      sr.textContent = text;
      wrap.append(sr);
    }
    const seen = document.createElement("span");
    seen.setAttribute("aria-hidden", "true");
    for (const token of text.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        seen.append(document.createTextNode(token));
        continue;
      }
      const word = document.createElement("span");
      word.className = "k-dw";
      for (const ch of Array.from(token)) {
        const letter = document.createElement("span");
        letter.className = "k-dc";
        letter.textContent = ch;
        word.append(letter);
      }
      seen.append(word);
    }
    wrap.append(seen);
    t.replaceWith(wrap);
    wrap.querySelectorAll<HTMLElement>(".k-dw").forEach(kern);
  }
}

export function Dragon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(".k-contact");
    if (!canvas || !section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    void document.fonts.ready.then(() => {
      if (cancelled) return;

      /* ---------- Layout, read in measure() ---------- */
      let vw = 0;
      let vh = 0;
      let dpr = 1;
      let secTop = 0;
      let secLeft = 0;
      let secW = 0;
      let secH = 0;
      let unit = 1;
      let enabled = false;
      let placed = false;
      let wasVisible = false;

      /* ---------- What it pushes ---------- */
      let bodies: Body[] = [];
      const known = new WeakMap<HTMLElement, Body>();
      let needCollect = true;
      let needMeasure = true;

      const collect = () => {
        needCollect = false;
        section.querySelectorAll<HTMLElement>(TEXT_TARGETS).forEach(splitLetters);
        const next: Body[] = [];
        const add = (el: HTMLElement, block: boolean) => {
          let b = known.get(el);
          if (!b) {
            b = { el, block, hx: 0, hy: 0, hw: 0, hh: 0, ox: 0, oy: 0, vx: 0, vy: 0, heat: 0, fx: 0, fy: 0, seed: next.length + 1, styled: false };
            known.set(el, b);
          }
          next.push(b);
        };
        section.querySelectorAll<HTMLElement>(".k-dc").forEach((el) => add(el, false));
        section.querySelectorAll<HTMLElement>(BLOCK_TARGETS).forEach((el) => add(el, true));
        bodies = next;
        observer.takeRecords(); // our own edits are not news
        needMeasure = true;
      };

      const measureBodies = () => {
        needMeasure = false;
        const sr = section.getBoundingClientRect();
        let size = 16;
        let parent: Element | null = null;
        for (const b of bodies) {
          const r = b.el.getBoundingClientRect();
          b.hx = r.left + r.width / 2 - sr.left - b.ox;
          b.hy = r.top + r.height / 2 - sr.top - b.oy;
          if (b.block) {
            if (!b.styled) {
              b.hw = r.width / 2;
              b.hh = r.height / 2;
            }
          } else {
            // A letter's box is as tall as its line; what the dragon meets is the letter itself.
            if (b.el.parentElement !== parent) {
              parent = b.el.parentElement;
              size = parent ? parseFloat(getComputedStyle(parent).fontSize) || 16 : 16;
            }
            b.hw = Math.min(r.width / 2, size * 0.4);
            b.hh = size * 0.34;
          }
        }
      };

      const settleAll = () => {
        for (const b of bodies) {
          b.ox = b.oy = b.vx = b.vy = b.heat = 0;
          if (b.styled) {
            b.el.style.translate = "";
            b.el.style.rotate = "";
            b.el.style.color = "";
            b.styled = false;
          }
        }
      };

      const observer = new MutationObserver(() => {
        needCollect = true;
      });
      observer.observe(section, { childList: true, subtree: true });
      /* Rows and headline lines slide into place; where they rest is only known once they stop. */
      const onSettled = () => {
        needMeasure = true;
      };
      /* A headline's lines rise from behind their own edge. A little after they are in, that edge is
         lifted, so the letters can be pushed past it. */
      const headlines = [...section.querySelectorAll<HTMLElement>("[data-lines]")];
      const inSince = new Map<HTMLElement, number>();
      const freeHeadlines = (time: number) => {
        for (const h of headlines) {
          if (h.hasAttribute("data-freed") || !h.hasAttribute("data-in") || !h.hasAttribute("data-split")) continue;
          const since = inSince.get(h);
          if (since === undefined) inSince.set(h, time);
          else if (time - since > 1500) {
            h.setAttribute("data-freed", "");
            needMeasure = true;
          }
        }
      };
      section.addEventListener("transitionend", onSettled);

      /* ---------- Dragon state (section px) ---------- */
      const sx = new Float32Array(N);
      const sy = new Float32Array(N);
      let heading = Math.PI;
      let speed = 0;
      let clock = 0;
      let fire = 0; // seconds of breath left
      let nextFire = 3.5;
      let jaw = 0;
      const circles: Circle[] = [];

      /* ---------- Embers ---------- */
      const ex = new Float32Array(MAX_EMBERS);
      const ey = new Float32Array(MAX_EMBERS);
      const evx = new Float32Array(MAX_EMBERS);
      const evy = new Float32Array(MAX_EMBERS);
      const eAge = new Float32Array(MAX_EMBERS);
      const eLife = new Float32Array(MAX_EMBERS);
      const eSize = new Float32Array(MAX_EMBERS);
      const eSpin = new Float32Array(MAX_EMBERS);
      let emberHead = 0;
      let emberDebt = 0;

      /* ---------- Pointer ---------- */
      let haveClient = false;
      let lastClientX = 0;
      let lastClientY = 0;
      let px = 0;
      let py = 0;
      let pointerIn = false;
      const onMove = (e: PointerEvent) => {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        haveClient = e.pointerType !== "touch";
      };
      const onDown = (e: PointerEvent) => {
        onMove(e);
        if (pointerIn) fire = Math.max(fire, 1.1);
      };
      const onOut = (e: PointerEvent) => {
        if (!e.relatedTarget) haveClient = false;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerout", onOut, { passive: true });

      const measure = () => {
        vw = window.innerWidth;
        vh = window.innerHeight;
        const was = enabled;
        enabled = vw >= MIN_WIDTH;
        if (was && !enabled) {
          settleAll();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          dragonField.circles.length = 0;
          dragonField.listeners.forEach((l) => l());
        }
        if (!enabled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(vw * ratio) || canvas.height !== Math.round(vh * ratio)) {
          dpr = ratio;
          canvas.width = Math.round(vw * dpr);
          canvas.height = Math.round(vh * dpr);
        }
        secTop = documentTop(section);
        secLeft = section.getBoundingClientRect().left + window.scrollX;
        secW = section.offsetWidth;
        secH = section.offsetHeight;
        unit = clamp(vw / 1300, 0.85, 1.3);
        if (needCollect) collect();
        measureBodies();
      };

      /* ---------- Dragon ---------- */
      const stepDragon = (dt: number, top: number, bottom: number) => {
        clock += dt;
        let tx: number;
        let ty: number;
        if (pointerIn) {
          tx = px;
          ty = py;
        } else {
          // No pointer: a slow figure through whatever part of the section is on screen.
          tx = secW * 0.5 + Math.sin(clock * 0.31) * secW * 0.4;
          ty = (top + bottom) / 2 + Math.sin(clock * 0.47 + 1.1) * (bottom - top) * 0.36;
        }
        tx = clamp(tx, 24, secW - 24);
        ty = clamp(ty, 24, secH - 24);
        const dx = tx - sx[0];
        const dy = ty - sy[0];
        const dist = Math.hypot(dx, dy);
        let diff = Math.atan2(dy, dx) - heading;
        diff = ((((diff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        // A limited turn rate is what makes it circle and coil rather than stop dead on the target.
        const turn = 2.7 * dt;
        heading += clamp(diff, -turn, turn);
        const want = (pointerIn ? clamp(dist * 1.7, 135, 560) : 125) * unit;
        speed += (want - speed) * Math.min(1, dt * 4);
        const slither = Math.sin(clock * 5.4) * 0.4 * Math.min(1, speed / 170);
        sx[0] += Math.cos(heading + slither) * speed * dt;
        sy[0] += Math.sin(heading + slither) * speed * dt;

        const seg = 12 * unit;
        for (let i = 1; i < N; i++) {
          const ddx = sx[i - 1] - sx[i];
          const ddy = sy[i - 1] - sy[i];
          const d = Math.hypot(ddx, ddy) || 1;
          const k = (d - seg) / d;
          sx[i] += ddx * k;
          sy[i] += ddy * k;
        }

        // Fire: on a click, and by itself every few seconds.
        nextFire -= dt;
        if (nextFire <= 0) {
          fire = Math.max(fire, 1.25);
          nextFire = 4 + hash(Math.floor(clock * 10), 3) * 3.5;
        }
        if (fire > 0) fire -= dt;
        jaw += ((fire > 0 ? 1 : 0) - jaw) * Math.min(1, dt * 10);
      };

      /** Unit direction the head is pointing, from the first two spine points. */
      const headDir = () => {
        const dx = sx[0] - sx[2];
        const dy = sy[0] - sy[2];
        const d = Math.hypot(dx, dy) || 1;
        return [dx / d, dy / d] as const;
      };

      const WING_AT = 8;
      const WING_SCALE = 1.65;
      const wingFlap = (side: number) =>
        0.74 + 0.26 * Math.sin(clock * (5 + Math.min(4, speed / 90)) + (side > 0 ? 0 : 0.5));

      /** The body as circles, and the box around them. */
      let boxL = 0;
      let boxT = 0;
      let boxR = 0;
      let boxB = 0;
      const collectCircles = () => {
        circles.length = 0;
        for (let i = 0; i < N; i += 2) {
          circles.push({ x: sx[i], y: sy[i], r: girth(i / (N - 1)) * unit + PAD });
        }
        const [hx, hy] = headDir();
        circles.push({ x: sx[0] + hx * 9 * unit, y: sy[0] + hy * 9 * unit, r: 12 * unit + PAD });
        const ax = sx[WING_AT - 1] - sx[WING_AT + 1];
        const ay = sy[WING_AT - 1] - sy[WING_AT + 1];
        const al = Math.hypot(ax, ay) || 1;
        const fx = ax / al;
        const fy = ay / al;
        for (const side of [1, -1]) {
          const f = wingFlap(side) * side * unit * WING_SCALE;
          const nx = -fy * f;
          const ny = fx * f;
          circles.push({ x: sx[WING_AT] - fx * 5 * unit + nx * 28, y: sy[WING_AT] - fy * 5 * unit + ny * 28, r: 19 * unit + PAD });
          circles.push({ x: sx[WING_AT] - fx * 16 * unit + nx * 48, y: sy[WING_AT] - fy * 16 * unit + ny * 48, r: 15 * unit + PAD });
        }
        boxL = boxT = Infinity;
        boxR = boxB = -Infinity;
        for (const c of circles) {
          boxL = Math.min(boxL, c.x - c.r);
          boxT = Math.min(boxT, c.y - c.r);
          boxR = Math.max(boxR, c.x + c.r);
          boxB = Math.max(boxB, c.y + c.r);
        }
      };

      /* ---------- Embers ---------- */
      const stepEmbers = (dt: number) => {
        if (fire > 0) {
          const [hx, hy] = headDir();
          const mx = sx[0] + hx * 22 * unit;
          const my = sy[0] + hy * 22 * unit;
          emberDebt += dt * 170;
          while (emberDebt >= 1) {
            emberDebt -= 1;
            const i = emberHead;
            emberHead = (emberHead + 1) % MAX_EMBERS;
            const a = Math.atan2(hy, hx) + (Math.random() - 0.5) * 0.62;
            const v = (240 + Math.random() * 240) * unit;
            ex[i] = mx;
            ey[i] = my;
            evx[i] = Math.cos(a) * v;
            evy[i] = Math.sin(a) * v;
            eAge[i] = 0;
            eLife[i] = 0.55 + Math.random() * 0.75;
            eSize[i] = (3 + Math.random() * 6) * unit;
            eSpin[i] = Math.random() * TAU;
          }
        }
        const drag = Math.exp(-dt * 1.9);
        for (let i = 0; i < MAX_EMBERS; i++) {
          if (eLife[i] === 0) continue;
          eAge[i] += dt;
          if (eAge[i] >= eLife[i]) {
            eLife[i] = 0;
            continue;
          }
          evx[i] *= drag;
          evy[i] = evy[i] * drag - 34 * dt; // embers rise
          ex[i] += evx[i] * dt;
          ey[i] += evy[i] * dt;
        }
      };

      /* ---------- Pushing the page about ---------- */
      const stepBodies = (dt: number) => {
        const burning = fire > 0;
        const [fdx, fdy] = headDir();
        const mx = sx[0] + fdx * 22 * unit;
        const my = sy[0] + fdy * 22 * unit;
        const reach = 210 * unit;
        const cool = Math.exp(-dt * 1.15);
        for (const b of bodies) {
          const cx = b.hx + b.ox;
          const cy = b.hy + b.oy;
          const near = b.hx + b.hw > boxL && b.hx - b.hw < boxR && b.hy + b.hh > boxT && b.hy - b.hh < boxB;
          const inBreath = burning && !b.block && Math.abs(cx - mx) < reach && Math.abs(cy - my) < reach;
          if (!near && !inBreath && !b.styled && b.heat === 0) continue;

          // Where it should be: clear of every part of the body that overlaps its place.
          let tx = 0;
          let ty = 0;
          if (near) {
            for (const c of circles) {
              const qx = clamp(c.x, b.hx - b.hw, b.hx + b.hw);
              const qy = clamp(c.y, b.hy - b.hh, b.hy + b.hh);
              const d = Math.hypot(qx - c.x, qy - c.y);
              if (d >= c.r) continue;
              let ux = b.hx - c.x;
              let uy = b.hy - c.y;
              const ul = Math.hypot(ux, uy);
              if (ul < 0.01) {
                ux = 0;
                uy = -1;
              } else {
                ux /= ul;
                uy /= ul;
              }
              tx += ux * (c.r - d) * 0.7;
              ty += uy * (c.r - d) * 0.7;
            }
            const limit = b.block ? 44 : 78;
            const tl = Math.hypot(tx, ty);
            if (tl > limit) {
              tx *= limit / tl;
              ty *= limit / tl;
            }
          }

          if (inBreath) {
            const rx = cx - mx;
            const ry = cy - my;
            const along = rx * fdx + ry * fdy;
            if (along > 0 && along < reach && Math.abs(rx * fdy - ry * fdx) < 12 + along * 0.36) {
              b.heat = Math.min(1, b.heat + dt * 4.2 * (1 - along / reach));
              b.fx = fdx;
              b.fy = fdy;
            }
          }
          let spin = 0;
          if (b.heat > 0) {
            b.heat *= cool;
            if (b.heat < 0.004) b.heat = 0;
            const e = b.heat * b.heat * (3 - 2 * b.heat);
            const a = hash(b.seed, 1) * TAU;
            tx += (Math.cos(a) * 14 + b.fx * 34) * e;
            ty += (Math.sin(a) * 14 + b.fy * 34 - 8) * e;
            spin = (hash(b.seed, 2) - 0.5) * 2.2 * e;
            b.el.style.color = e > 0.45 ? EMBER[2] : "";
          }

          // A slightly loose spring, so things overshoot a little as they come home.
          b.vx += ((tx - b.ox) * 170 - b.vx * 17) * dt;
          b.vy += ((ty - b.oy) * 170 - b.vy * 17) * dt;
          b.ox += b.vx * dt;
          b.oy += b.vy * dt;

          if (tx === 0 && ty === 0 && b.heat === 0 && Math.abs(b.ox) + Math.abs(b.oy) < 0.08 && Math.abs(b.vx) + Math.abs(b.vy) < 2) {
            b.ox = b.oy = b.vx = b.vy = 0;
            b.el.style.translate = "";
            b.el.style.rotate = "";
            b.el.style.color = "";
            b.styled = false;
            continue;
          }
          const lean = clamp(b.ox * 0.011 + b.oy * 0.004 * (hash(b.seed, 4) - 0.5) * 2, -0.7, 0.7) * (b.block ? 0.2 : 1) + spin;
          b.el.style.translate = `${b.ox.toFixed(2)}px ${b.oy.toFixed(2)}px`;
          b.el.style.rotate = `${lean.toFixed(3)}rad`;
          b.styled = true;
        }
      };

      /* ---------- Drawing the dragon ---------- */
      const lx = new Float32Array(N);
      const ly = new Float32Array(N);
      const rx = new Float32Array(N);
      const ry = new Float32Array(N);

      const drawWing = (side: number) => {
        const i = WING_AT;
        const ax = sx[i - 1] - sx[i + 1];
        const ay = sy[i - 1] - sy[i + 1];
        const al = Math.hypot(ax, ay) || 1;
        const fx = ax / al;
        const fy = ay / al;
        const s = unit * WING_SCALE;
        const f = wingFlap(side) * side;
        // Local point: `a` along the body toward the head, `n` out from the body.
        const X = (a: number, n: number) => sx[i] + fx * a * s - fy * n * f * s;
        const Y = (a: number, n: number) => sy[i] + fy * a * s + fx * n * f * s;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(X(9, 4), Y(9, 4));
        ctx.lineTo(X(19, 34), Y(19, 34));
        ctx.lineTo(X(6, 64), Y(6, 64));
        ctx.quadraticCurveTo(X(-4, 44), Y(-4, 44), X(-22, 52), Y(-22, 52));
        ctx.quadraticCurveTo(X(-20, 34), Y(-20, 34), X(-40, 31), Y(-40, 31));
        ctx.quadraticCurveTo(X(-26, 17), Y(-26, 17), X(-30, 4), Y(-30, 4));
        ctx.closePath();
        ctx.fill();
        // Finger bones, cut out in the page's colour.
        ctx.strokeStyle = PERSIMMON;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const [a, n] of [
          [6, 64],
          [-22, 52],
          [-40, 31],
        ] as const) {
          ctx.moveTo(X(17, 31), Y(17, 31));
          ctx.lineTo(X(a * 0.94, n * 0.94), Y(a * 0.94, n * 0.94));
        }
        ctx.stroke();
      };

      const drawLeg = (i: number, side: number, phase: number) => {
        const ax = sx[i - 1] - sx[i + 1];
        const ay = sy[i - 1] - sy[i + 1];
        const al = Math.hypot(ax, ay) || 1;
        const fx = ax / al;
        const fy = ay / al;
        const r = girth(i / (N - 1)) * unit;
        const stride = Math.sin(clock * 9 * Math.min(1, speed / 200) + phase) * 5 * unit;
        const nx = -fy * side;
        const ny = fx * side;
        const kx = sx[i] + nx * (r + 7 * unit) + fx * (3 * unit + stride);
        const ky = sy[i] + ny * (r + 7 * unit) + fy * (3 * unit + stride);
        const px2 = kx + nx * 6 * unit + fx * (7 * unit + stride);
        const py2 = ky + ny * 6 * unit + fy * (7 * unit + stride);
        ctx.strokeStyle = INK;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 4.2 * unit;
        ctx.beginPath();
        ctx.moveTo(sx[i] + nx * r * 0.6, sy[i] + ny * r * 0.6);
        ctx.lineTo(kx, ky);
        ctx.lineTo(px2, py2);
        ctx.stroke();
        // Claws.
        ctx.lineWidth = 1.5 * unit;
        ctx.beginPath();
        for (const t of [-0.6, 0, 0.6]) {
          const cx = fx * Math.cos(t) - fy * Math.sin(t);
          const cy = fy * Math.cos(t) + fx * Math.sin(t);
          ctx.moveTo(px2, py2);
          ctx.lineTo(px2 + cx * 5.5 * unit, py2 + cy * 5.5 * unit);
        }
        ctx.stroke();
      };

      const drawDragon = () => {
        // Outline points either side of the spine.
        for (let i = 0; i < N; i++) {
          const a = Math.max(0, i - 1);
          const b = Math.min(N - 1, i + 1);
          const tx = sx[a] - sx[b];
          const ty = sy[a] - sy[b];
          const tl = Math.hypot(tx, ty) || 1;
          const r = girth(i / (N - 1)) * unit;
          lx[i] = sx[i] - (ty / tl) * r;
          ly[i] = sy[i] + (tx / tl) * r;
          rx[i] = sx[i] + (ty / tl) * r;
          ry[i] = sy[i] - (tx / tl) * r;
        }

        drawLeg(10, 1, 0);
        drawLeg(10, -1, Math.PI);
        drawLeg(21, 1, Math.PI);
        drawLeg(21, -1, 0);
        drawWing(1);
        drawWing(-1);

        // Body: one smooth outline, down one side and back up the other.
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(lx[1], ly[1]);
        for (let i = 2; i < N - 1; i++) {
          ctx.quadraticCurveTo(lx[i], ly[i], (lx[i] + lx[i + 1]) / 2, (ly[i] + ly[i + 1]) / 2);
        }
        ctx.lineTo(sx[N - 1], sy[N - 1]);
        for (let i = N - 2; i > 1; i--) {
          ctx.quadraticCurveTo(rx[i], ry[i], (rx[i] + rx[i - 1]) / 2, (ry[i] + ry[i - 1]) / 2);
        }
        ctx.lineTo(rx[1], ry[1]);
        ctx.closePath();
        ctx.fill();

        // Tail barb.
        {
          const tx = sx[N - 1] - sx[N - 3];
          const ty = sy[N - 1] - sy[N - 3];
          const tl = Math.hypot(tx, ty) || 1;
          const ux = tx / tl;
          const uy = ty / tl;
          const q = 6 * unit;
          ctx.beginPath();
          ctx.moveTo(sx[N - 1] + ux * q * 2, sy[N - 1] + uy * q * 2);
          ctx.lineTo(sx[N - 1] - uy * q, sy[N - 1] + ux * q);
          ctx.lineTo(sx[N - 1] - ux * q * 0.4, sy[N - 1] - uy * q * 0.4);
          ctx.lineTo(sx[N - 1] + uy * q, sy[N - 1] - ux * q);
          ctx.closePath();
          ctx.fill();
        }

        // Markings down the back: a diamond on each joint, a cross-stroke on every third.
        ctx.fillStyle = PERSIMMON;
        ctx.strokeStyle = PERSIMMON;
        ctx.lineWidth = 1;
        for (let i = 3; i < N - 4; i++) {
          const tx = sx[i - 1] - sx[i + 1];
          const ty = sy[i - 1] - sy[i + 1];
          const tl = Math.hypot(tx, ty) || 1;
          const ux = tx / tl;
          const uy = ty / tl;
          const r = girth(i / (N - 1)) * unit;
          const d = r * 0.3;
          ctx.beginPath();
          ctx.moveTo(sx[i] + ux * d * 1.5, sy[i] + uy * d * 1.5);
          ctx.lineTo(sx[i] - uy * d, sy[i] + ux * d);
          ctx.lineTo(sx[i] - ux * d * 1.5, sy[i] - uy * d * 1.5);
          ctx.lineTo(sx[i] + uy * d, sy[i] - ux * d);
          ctx.closePath();
          ctx.fill();
          if (i % 3 === 0 && r > 5) {
            ctx.beginPath();
            ctx.moveTo(sx[i] - uy * r * 0.82, sy[i] + ux * r * 0.82);
            ctx.lineTo(sx[i] - uy * r * 0.48, sy[i] + ux * r * 0.48);
            ctx.moveTo(sx[i] + uy * r * 0.82, sy[i] - ux * r * 0.82);
            ctx.lineTo(sx[i] + uy * r * 0.48, sy[i] - ux * r * 0.48);
            ctx.stroke();
          }
        }

        // Head, drawn in its own frame: x forward, y across.
        const [hx, hy] = headDir();
        ctx.save();
        ctx.translate(sx[0], sy[0]);
        ctx.rotate(Math.atan2(hy, hx));
        ctx.scale(unit, unit);
        // Tongue, flicking; held in while breathing fire.
        const flick = Math.max(0, Math.sin(clock * 4.2)) * (1 - jaw);
        if (flick > 0.05) {
          ctx.strokeStyle = PAPER;
          ctx.lineWidth = 1.3;
          ctx.lineCap = "round";
          const w = Math.sin(clock * 31) * 1.6;
          ctx.beginPath();
          ctx.moveTo(22, 0);
          ctx.quadraticCurveTo(22 + 6 * flick, w, 22 + 11 * flick, 0);
          ctx.lineTo(22 + 16 * flick, -3.2);
          ctx.moveTo(22 + 11 * flick, 0);
          ctx.lineTo(22 + 16 * flick, 3.2);
          ctx.stroke();
        }
        ctx.fillStyle = INK;
        // Horns, swept back.
        for (const side of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(-2, 8 * side);
          ctx.quadraticCurveTo(-14, 13 * side, -24, 17 * side);
          ctx.quadraticCurveTo(-13, 8 * side, -8, 3 * side);
          ctx.closePath();
          ctx.fill();
        }
        // Skull and snout; the jaws part a little when it breathes.
        const gape = jaw * 3.2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.quadraticCurveTo(-8, 11, 3, 10.5);
        ctx.quadraticCurveTo(13, 7.5 + gape, 23, 2.6 + gape);
        ctx.lineTo(18, 0);
        ctx.lineTo(23, -2.6 - gape);
        ctx.quadraticCurveTo(13, -7.5 - gape, 3, -10.5);
        ctx.quadraticCurveTo(-8, -11, -10, 0);
        ctx.closePath();
        ctx.fill();
        // Eyes and nostrils.
        ctx.fillStyle = PAPER;
        for (const side of [1, -1]) {
          ctx.beginPath();
          ctx.ellipse(5, 6 * side, 2.6, 1.5, 0.35 * side, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = PERSIMMON;
        for (const side of [1, -1]) {
          ctx.beginPath();
          ctx.arc(17, 2.4 * side + gape * side * 0.6, 0.8, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      };

      const drawEmbers = () => {
        for (let i = 0; i < MAX_EMBERS; i++) {
          if (eLife[i] === 0) continue;
          const t = eAge[i] / eLife[i];
          ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
          ctx.fillStyle = EMBER[t < 0.22 ? 0 : t < 0.55 ? 1 : 2];
          const s = eSize[i] * (1 - t * 0.55);
          ctx.save();
          ctx.translate(ex[i], ey[i]);
          ctx.rotate(eSpin[i] + t * 5);
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      };


      const stopScene = addScene({
        measure,
        update({ dt, scroll, time }) {
          if (!enabled) return;
          // The part of the section that is on screen, in section px.
          const top = Math.max(0, scroll - secTop);
          const bottom = Math.min(secH, scroll + vh - secTop);
          const visible = bottom > top;
          if (!visible) {
            if (wasVisible) {
              wasVisible = false;
              settleAll();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              dragonField.circles.length = 0;
              dragonField.listeners.forEach((l) => l());
            }
            return;
          }
          wasVisible = true;
          freeHeadlines(time);
          // Rare, and only after the page itself has changed: find the letters again, or where they rest.
          if (needCollect) collect();
          if (needMeasure) measureBodies();

          if (!placed) {
            const y0 = (top + bottom) / 2;
            for (let i = 0; i < N; i++) {
              sx[i] = secW * 0.72 + i * 12 * unit;
              sy[i] = y0;
            }
            heading = Math.PI;
            placed = true;
          }
          px = lastClientX - secLeft;
          py = lastClientY - (secTop - scroll);
          pointerIn = haveClient && px > 0 && px < secW && py > top && py < bottom;

          const step = Math.min(dt, 50) / 1000;
          stepDragon(step, top, bottom);
          stepEmbers(step);
          collectCircles();
          stepBodies(step);

          // Tell the dot map where the body is, in viewport px.
          const offX = secLeft;
          const offY = secTop - scroll;
          const shared = dragonField.circles;
          shared.length = circles.length;
          for (let i = 0; i < circles.length; i++) {
            const c = circles[i];
            const s = (shared[i] ??= { x: 0, y: 0, r: 0 });
            s.x = c.x + offX;
            s.y = c.y + offY;
            s.r = c.r;
          }
          dragonField.listeners.forEach((l) => l());

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, vw, vh);
          ctx.save();
          ctx.translate(offX, offY);
          // It stays inside the section: nothing of it shows over the page above.
          ctx.beginPath();
          ctx.rect(0, 0, secW, secH);
          ctx.clip();
          drawDragon();
          drawEmbers();
          ctx.restore();
        },
      });

      teardown = () => {
        stopScene();
        observer.disconnect();
        section.removeEventListener("transitionend", onSettled);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerout", onOut);
        settleAll();
        dragonField.circles.length = 0;
        dragonField.listeners.forEach((l) => l());
        // Put the plain text back.
        section.querySelectorAll<HTMLElement>(".k-dsplit").forEach((w) => w.replaceWith(document.createTextNode(w.dataset.text ?? "")));
      };
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return <canvas ref={canvasRef} className="k-dragon-canvas" aria-hidden="true" />;
}
