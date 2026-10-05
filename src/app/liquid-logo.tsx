"use client";

import { LiquidMetal } from "@paper-design/shaders-react";

import { CREAM_PATH } from "./logo-paths";

/**
 * The logo's letters as an image for the shader, on the hero's own view box (see VB in
 * motion-home.tsx), so the metal lands exactly on the letters underneath it.
 */
const LETTERS = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="360 290 950 410" width="1900" height="820"><path d="${CREAM_PATH}" fill="#000"/></svg>`,
)}`;

/**
 * Liquid metal poured into the logo's letters (Paper Shaders). Mounted over the hero logo for a few
 * seconds as it lands, then removed: see the `metal` state in motion-home.tsx.
 */
export default function LiquidLogo() {
  return (
    <LiquidMetal
      className="k-metal-canvas"
      image={LETTERS}
      colorBack="#00000000"
      colorTint="#f8f5f0"
      fit="contain"
      scale={1}
      speed={0.9}
      repetition={2.2}
      softness={0.12}
      shiftRed={0.08}
      shiftBlue={0.08}
      distortion={0.08}
      contour={0.5}
      angle={70}
    />
  );
}
