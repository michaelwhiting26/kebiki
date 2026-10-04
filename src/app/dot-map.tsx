"use client";

import { useEffect, useRef, useState } from "react";

import { addScene, documentTop, lastFrameScroll } from "./clock";

/**
 * A land mass drawn as a field of small dots that gently part around the pointer and spring back.
 *
 * The SVG path is the authoritative shape. At init (and on resize) it is rasterised once into an
 * offscreen canvas, and a hex grid is sampled for land coverage; each cell that is mostly land
 * becomes a dot whose size follows its coverage, and a second pass keeps thin islands. Particle
 * state lives in typed arrays outside React; one canvas per map, one fill per frame, and the loop
 * sleeps whenever nothing is moving.
 */
export type DotMapProps = {
  /** SVG path data, in a 0..w by 0..h coordinate space. */
  d: string;
  w: number;
  h: number;
  label: string;
  /** Pointer interaction radius in CSS px (reduced automatically on small screens). */
  interactionRadius?: number;
  /** Spring strength pulling each dot home, per frame. */
  spring?: number;
  /** Velocity retained each frame (0..1). */
  damping?: number;
  /** Repulsion impulse at the pointer, per frame. */
  push?: number;
  /** Largest distance a dot may be displaced, as a fraction of the interaction radius. */
  maxDisplacement?: number;
};

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

type Field = {
  n: number;
  hx: Float32Array;
  hy: Float32Array;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  r: Float32Array;
};

/** Builds the dot field for a map drawn at cssW x cssH. Runs once per size, never per frame. */
function buildField(d: string, w: number, h: number, cssW: number, cssH: number): Field {
  // Spacing scales with the map's size: ~5-7px on desktop, finer on small screens to keep the shape.
  const spacing = clamp(cssH / 50, 3.0, 6.2);
  const rowH = spacing * 0.866; // hex grid

  // Rasterise the exact path at 3x so thin features survive; cap the pixel count.
  let res = 3;
  while (cssW * res * cssH * res > 4_500_000 && res > 1) res -= 1;
  const mw = Math.max(1, Math.round(cssW * res));
  const mh = Math.max(1, Math.round(cssH * res));
  const off = document.createElement("canvas");
  off.width = mw;
  off.height = mh;
  const octx = off.getContext("2d", { willReadFrequently: true })!;
  octx.setTransform((mw / w), 0, 0, (mh / h), 0, 0);
  octx.fillStyle = "#000";
  octx.fill(new Path2D(d));
  const alpha = octx.getImageData(0, 0, mw, mh).data;

  /** Fraction of the rectangle (css px) that is land. */
  const coverage = (cx: number, cy: number, halfW: number, halfH: number) => {
    const x0 = clamp(Math.floor((cx - halfW) * res), 0, mw - 1);
    const x1 = clamp(Math.ceil((cx + halfW) * res), 0, mw);
    const y0 = clamp(Math.floor((cy - halfH) * res), 0, mh - 1);
    const y1 = clamp(Math.ceil((cy + halfH) * res), 0, mh);
    let sum = 0;
    let count = 0;
    for (let yy = y0; yy < y1; yy++) {
      let idx = (yy * mw + x0) * 4 + 3;
      for (let xx = x0; xx < x1; xx++, idx += 4) {
        sum += alpha[idx];
        count++;
      }
    }
    return count ? sum / (count * 255) : 0;
  };

  const px: number[] = [];
  const py: number[] = [];
  const pr: number[] = [];
  const base = clamp(spacing * 0.36, 1.0, 2.3);

  // Pass 1: the main hex grid.
  for (let row = 0, y = rowH / 2; y < cssH; row++, y += rowH) {
    const shift = row % 2 ? spacing / 2 : 0;
    for (let x = spacing / 2 + shift; x < cssW; x += spacing) {
      const cov = coverage(x, y, spacing / 2, rowH / 2);
      if (cov >= 0.32) {
        px.push(x);
        py.push(y);
        pr.push(base * (0.8 + 0.2 * clamp(cov, 0, 1)));
      }
    }
  }

  // Pass 2: thin islands the main grid missed (finer candidates, kept only if clear of existing dots).
  const fine = spacing * 0.55;
  const minGap2 = spacing * 0.78 * (spacing * 0.78);
  for (let y = fine / 2; y < cssH; y += fine) {
    for (let x = fine / 2; x < cssW; x += fine) {
      if (coverage(x, y, fine / 2, fine / 2) < 0.45) continue;
      let clear = true;
      for (let i = 0; i < px.length; i++) {
        const dx = px[i] - x;
        const dy = py[i] - y;
        if (dx * dx + dy * dy < minGap2) {
          clear = false;
          break;
        }
      }
      if (clear) {
        px.push(x);
        py.push(y);
        pr.push(base * 0.72);
      }
    }
  }

  const n = px.length;
  const f: Field = {
    n,
    hx: Float32Array.from(px),
    hy: Float32Array.from(py),
    x: Float32Array.from(px),
    y: Float32Array.from(py),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    r: Float32Array.from(pr),
  };
  return f;
}

export function InteractiveDotMap({
  d,
  w,
  h,
  label,
  interactionRadius = 120,
  spring = 0.065,
  damping = 0.86,
  push = 2.4,
  maxDisplacement = 0.5,
}: DotMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = getComputedStyle(box).color || "#0e0e10";

    let field: Field | null = null;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let R = interactionRadius;
    let maxD = R * maxDisplacement;
    let visible = true;
    let running = false;
    let raf = 0;
    let resizeRaf = 0;
    // Pointer, in this canvas's CSS pixels.
    let px = 0;
    let py = 0;
    let pointerActive = false;
    let lastClientX = 0;
    let lastClientY = 0;
    let haveClient = false;

    const draw = () => {
      if (!field) return;
      const { n, x, y, hx, hy, r } = field;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = color;
      ctx.beginPath();
      const md2 = maxD * maxD;
      for (let i = 0; i < n; i++) {
        const ddx = x[i] - hx[i];
        const ddy = y[i] - hy[i];
        // Strongly displaced dots shrink slightly (at most ~16%), then recover at rest.
        const shrink = md2 > 0 ? Math.min(1, (ddx * ddx + ddy * ddy) / md2) : 0;
        const rad = r[i] * (1 - 0.16 * shrink);
        ctx.moveTo(x[i] + rad, y[i]);
        ctx.arc(x[i], y[i], rad, 0, TAU);
      }
      ctx.fill();
    };

    /** One physics step. Returns true while anything is still moving. */
    const step = () => {
      const f = field!;
      const { n, x, y, vx, vy, hx, hy } = f;
      const R2 = R * R;
      const md2 = maxD * maxD;
      let moving = false;
      for (let i = 0; i < n; i++) {
        let ax = (hx[i] - x[i]) * spring;
        let ay = (hy[i] - y[i]) * spring;
        if (pointerActive) {
          const dx = x[i] - px;
          const dy = y[i] - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const dist = Math.sqrt(d2);
            const t = 1 - dist / R; // 1 at the pointer, 0 at the radius
            const force = t * t * push; // smooth falloff
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
        }
        vx[i] = (vx[i] + ax) * damping;
        vy[i] = (vy[i] + ay) * damping;
        x[i] += vx[i];
        y[i] += vy[i];
        // Keep displacement controlled: past the limit the dot is eased back, never snapped.
        const ox = x[i] - hx[i];
        const oy = y[i] - hy[i];
        const o2 = ox * ox + oy * oy;
        if (o2 > md2) {
          const s = maxD / Math.sqrt(o2);
          x[i] = hx[i] + ox * s;
          y[i] = hy[i] + oy * s;
          vx[i] *= 0.6;
          vy[i] *= 0.6;
        }
        if (o2 > 0.0004 || Math.abs(vx[i]) + Math.abs(vy[i]) > 0.008) moving = true;
      }
      return moving;
    };

    const settle = () => {
      const f = field;
      if (!f) return;
      f.x.set(f.hx);
      f.y.set(f.hy);
      f.vx.fill(0);
      f.vy.fill(0);
    };

    const frame = () => {
      raf = 0;
      if (!field || !visible) {
        running = false;
        return;
      }
      const moving = step();
      draw();
      if (moving || pointerActive) {
        raf = requestAnimationFrame(frame);
      } else {
        // Everything is back home: sleep until the next pointer interaction.
        settle();
        draw();
        running = false;
      }
    };

    const wake = () => {
      if (running || reduce || !visible || !field) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    /* The map's place in the document, measured when the layout changes (see ./clock). */
    let boxTop = 0;
    let boxLeft = 0;
    const measurePlace = () => {
      boxTop = documentTop(box);
      boxLeft = box.getBoundingClientRect().left + window.scrollX;
    };
    measurePlace();

    /** Convert the last known client position into this canvas's space and decide whether to react. */
    const updatePointer = (scroll = lastFrameScroll()) => {
      if (!haveClient || reduce) return;
      // From the map's cached place in the document: no layout is read here.
      px = lastClientX - boxLeft;
      py = lastClientY - (boxTop - scroll);
      const near = px > -R && px < cssW + R && py > -R && py < cssH + R && visible;
      if (near) {
        pointerActive = true;
        wake();
      } else if (pointerActive) {
        pointerActive = false;
        wake(); // let the field reform
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      haveClient = true;
      updatePointer();
    };
    const release = () => {
      haveClient = false;
      if (pointerActive) {
        pointerActive = false;
        wake();
      }
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) release(); // the pointer left the window
    };

    /** (Re)build for the current size: canvas backing store, interaction radius, and the dot field. */
    const rebuild = () => {
      const rect = box.getBoundingClientRect();
      const nw = Math.round(rect.width);
      const nh = Math.round(rect.height);
      if (nw < 2 || nh < 2) return;
      if (nw === cssW && nh === cssH && field) return;
      cssW = nw;
      cssH = nh;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The interaction radius stays in CSS px, but is gentler on narrow screens.
      R = window.innerWidth < 640 ? Math.min(interactionRadius, 84) : interactionRadius;
      maxD = reduce ? 0 : R * maxDisplacement;
      field = buildField(d, w, h, cssW, cssH);
      draw();
      setReady(true);
      if (pointerActive) updatePointer();
    };

    rebuild();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(rebuild);
    });
    ro.observe(box);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible && pointerActive) pointerActive = false;
        if (visible) {
          draw();
          if (haveClient) updatePointer();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(box);

    if (!reduce) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerMove, { passive: true });
      window.addEventListener("pointerup", release, { passive: true });
      window.addEventListener("pointercancel", release, { passive: true });
      window.addEventListener("pointerout", onOut, { passive: true });
    }
    /* While the page scrolls under a resting pointer, the pointer's place on the map moves with it. */
    let seenScroll = NaN;
    const stopScene = reduce
      ? null
      : addScene({
          measure: measurePlace,
          update({ scroll }) {
            if (scroll === seenScroll) return;
            seenScroll = scroll;
            if (haveClient) updatePointer(scroll);
          },
        });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      stopScene?.();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("pointerout", onOut);
    };
  }, [d, w, h, interactionRadius, spring, damping, push, maxDisplacement]);

  return (
    <div
      ref={boxRef}
      className="k-dotmap"
      role="img"
      aria-label={label}
      // Sized from its width (never from height): WebKit collapses a height-driven aspect-ratio box
      // inside a flex container to zero width. --ratio lets the stylesheet cap it to the column.
      style={{ aspectRatio: `${w} / ${h}`, ["--ratio" as string]: String(w / h) } as React.CSSProperties}
    >
      {/* Static fallback until the dots are drawn (and for no-JS): the exact original silhouette. */}
      <svg
        className="k-dotmap-fallback"
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden="true"
        style={{ visibility: ready ? "hidden" : "visible" }}
      >
        <path d={d} />
      </svg>
      <canvas ref={canvasRef} className="k-dotmap-canvas" aria-hidden="true" />
    </div>
  );
}
