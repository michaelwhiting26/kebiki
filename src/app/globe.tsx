"use client";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";

import { addScene, documentTop } from "./clock";

/** Dubai, and the rotation that brings a place to the front of the globe. */
const DUBAI: [number, number] = [25.2048, 55.2708];
const facing = (lon: number) => Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2);
const TILT = 0.28;
/** Radians per millisecond: one turn in about 70 seconds. */
const SPIN = (Math.PI * 2) / 70000;

/**
 * The world as a field of dots, in the same language as the city map, turning slowly with Dubai
 * marked. Drawn by cobe on the page's one clock (./clock): it only draws while it is on screen,
 * can be dragged round, and holds still for visitors who ask for reduced motion.
 */
export function DotGlobe() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let globe: ReturnType<typeof createGlobe> | null = null;
    let size = 0;
    let top = 0;
    let phi = facing(DUBAI[1]);
    let drawn = false;

    /* Dragging turns it; the page still scrolls vertically through it (touch-action in the CSS). */
    let dragX: number | null = null;
    const onDown = (e: PointerEvent) => {
      dragX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (dragX === null) return;
      phi += (e.clientX - dragX) * 0.006;
      dragX = e.clientX;
      drawn = false;
    };
    const onUp = () => {
      dragX = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const stop = addScene({
      measure() {
        top = documentTop(box);
        const w = box.offsetWidth;
        if (w < 2 || (w === size && globe)) return;
        size = w;
        // cobe takes CSS pixels and applies the pixel ratio itself.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const px = size;
        if (globe) {
          globe.update({ width: px, height: px, devicePixelRatio: dpr });
        } else {
          globe = createGlobe(canvas, {
            devicePixelRatio: dpr,
            width: px,
            height: px,
            phi,
            theta: TILT,
            dark: 0,
            diffuse: 0,
            mapSamples: 20000,
            mapBrightness: 12,
            mapBaseBrightness: 0,
            // The sphere and its glow are the page's own orange, so only the dots read.
            baseColor: [0.925, 0.376, 0.165],
            glowColor: [0.925, 0.376, 0.165],
            markerColor: [0.973, 0.961, 0.941],
            markers: [{ location: DUBAI, size: 0.085 }],
          });
        }
        drawn = false;
      },
      update({ scroll, vh, dt }) {
        if (!globe) return;
        const y = top - scroll;
        if (y > vh || y + size < 0) return; // off screen: draw nothing
        if (!reduce && dragX === null) phi += SPIN * dt;
        else if (drawn) return; // holding still: the last frame stands
        globe.update({ phi });
        drawn = true;
      },
    });

    return () => {
      stop();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      globe?.destroy();
    };
  }, []);

  return (
    <div ref={boxRef} className="k-globe" role="img" aria-label="A globe of dots, with Dubai marked">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
