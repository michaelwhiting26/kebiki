"use client";

import {
  ShaderFitOptions,
  defaultObjectSizing,
  getShaderColorFromString,
  liquidMetalFragmentShader,
  toProcessedLiquidMetal,
} from "@paper-design/shaders";
import { ShaderMount } from "@paper-design/shaders-react";
import { useEffect, useState } from "react";

import { CREAM_PATH } from "./logo-paths";

/**
 * The logo's letters as an image for the shader, on the hero's own view box (see VB in
 * motion-home.tsx), so the metal lands exactly on the letters.
 */
const LETTERS = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="360 290 950 410" width="1900" height="820"><path d="${CREAM_PATH}" fill="#000"/></svg>`,
)}`;

const UNIFORMS = {
  u_colorBack: getShaderColorFromString("#00000000"),
  u_colorTint: getShaderColorFromString("#f8f5f0"),
  u_contour: 0.5,
  u_distortion: 0.08,
  u_softness: 0.12,
  u_repetition: 2.2,
  u_shiftRed: 0.08,
  u_shiftBlue: 0.08,
  u_angle: 70,
  u_isImage: true,
  u_shape: 0,
  u_fit: ShaderFitOptions[defaultObjectSizing.fit],
  u_scale: 1,
  u_rotation: 0,
  u_offsetX: 0,
  u_offsetY: 0,
  u_originX: 0.5,
  u_originY: 0.5,
  u_worldWidth: 0,
  u_worldHeight: 0,
} as const;

/**
 * The logo's letters in liquid metal (Paper Shaders). This is what the letters are made of, for as
 * long as the logo is on screen: the flat letters underneath are only a fallback.
 *
 * The letters image is prepared here, once, and `onReady` is called when the metal is actually on
 * the canvas, so the page can hold the logo back until then and never show it in plain cream.
 * `active` pauses the flow (the shader also pauses itself off screen and in a hidden tab).
 */
export default function LiquidLogo({ active, onReady }: { active: boolean; onReady: () => void }) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    let url = "";
    toProcessedLiquidMetal(LETTERS)
      .then(async (result) => {
        url = URL.createObjectURL(result.pngBlob);
        const img = new Image();
        img.src = url;
        await img.decode();
        if (current) setImage(url);
      })
      .catch(() => {
        /* No metal: the page falls back to the flat letters after a short wait. */
      });
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  /* A few frames after the shader mounts, its first drawing is on the canvas. */
  useEffect(() => {
    if (!image) return;
    let frames = 0;
    let raf = 0;
    const wait = () => {
      if (++frames >= 4) onReady();
      else raf = requestAnimationFrame(wait);
    };
    raf = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(raf);
  }, [image, onReady]);

  if (!image) return null;
  return (
    <ShaderMount
      className="k-metal-canvas"
      fragmentShader={liquidMetalFragmentShader}
      mipmaps={["u_image"]}
      uniforms={{ ...UNIFORMS, u_image: image }}
      speed={active ? 0.9 : 0}
      frame={0}
    />
  );
}
