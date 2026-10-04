"use client";

import { useEffect, useRef } from "react";
import { addScene, scrollVelocity, type FrameState } from "./clock";

/**
 * A fixed field of faint dots behind the dark sections, in the same dot language as the city maps.
 * It drifts slower than the page (so it reads as depth), stretches with scroll speed, and parts
 * around the pointer. Drawn on the shared clock; does nothing for reduced-motion visitors.
 */
const SPACING = 26; // css px between dots
const RADIUS = 1.05;
const DRIFT = 0.22; // the field moves at this fraction of the page's scroll speed
const POINTER_R = 150;
const POINTER_PUSH = 14;
const INK = "248, 245, 240";

export function ScrollField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const root = canvas.closest(".kmotion");
    let w = 0;
    let h = 0;
    let dpr = 0;
    /* Sized to the viewport. The clock calls this when the layout changes; it only acts on a new size. */
    const resize = () => {
      const nd = Math.min(window.devicePixelRatio || 1, 2);
      if (window.innerWidth === w && window.innerHeight === h && nd === dpr) return;
      dpr = nd;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    let px = -9999;
    let py = -9999;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
    };
    const onLeave = () => {
      px = py = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    let stretch = 0;
    const rowH = SPACING * 0.866; // hex rows

    const draw = ({ scroll }: FrameState) => {
      // Skip the work while the hero is still playing; the field only fades in after it.
      if (!root?.classList.contains("k-past")) return;
      const v = scrollVelocity();
      stretch += (Math.min(Math.abs(v) * 0.9, 16) - stretch) * 0.15;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${INK}, 0.09)`;

      const offset = -((scroll * DRIFT) % (rowH * 2));
      const rows = Math.ceil(h / rowH) + 3;
      const cols = Math.ceil(w / SPACING) + 2;
      const dir = v >= 0 ? 1 : -1;
      for (let r = -1; r < rows; r++) {
        const y0 = offset + r * rowH;
        const shift = (r & 1) * (SPACING / 2);
        for (let c = -1; c < cols; c++) {
          let x = c * SPACING + shift;
          let y = y0;
          const dx = x - px;
          const dy = y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < POINTER_R * POINTER_R) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / POINTER_R) ** 2 * POINTER_PUSH;
            x += (dx / d) * f;
            y += (dy / d) * f;
          }
          if (stretch > 0.6) {
            ctx.fillRect(x - RADIUS * 0.8, y - (dir > 0 ? 0 : stretch), RADIUS * 1.6, stretch + RADIUS);
          } else {
            ctx.beginPath();
            ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
    const stop = addScene({ measure: resize, update: draw });

    return () => {
      stop();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="k-field" aria-hidden="true" />;
}
