"use client";

import { EB_Garamond, Montserrat } from "next/font/google";
import { useEffect, useRef, useState } from "react";

import { CREAM_PATH, DOT_PATH, ORANGE_PATH } from "./logo-paths";
import "./motion.css";

/** The sentence's serif. */
const garamond = EB_Garamond({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
/** The tagline's geometric sans, set wide like the supplied logo. */
const montserrat = Montserrat({ subsets: ["latin"], weight: ["500"], display: "swap" });

const TAGLINE = "complex digital products, built to last.";
const SENTENCE =
  "Kebiki is a founder-led product strategy, design and engineering studio focused on turning complex ideas into refined digital products.";
const WORDS = SENTENCE.split(" ");

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const quadInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Progress of `p` through the window [a, b], clamped to 0..1. */
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

/* ---------- Logo geometry, in the artwork's own pixel space ---------- */
const VB = { x: 360, y: 290, w: 950, h: 410 };
/** The line the orange follows: along the rule, round the corner, up the stem of the final i. */
const ORANGE_CENTRELINE = "M371,588.5 H1204 A68.5,68.5 0 0 0 1272.5,520 V376";
/** Share of that line's length that is the straight rule (the rest is corner + stem). */
const RULE_SHARE = 833 / (833 + (Math.PI / 2) * 68.5 + 144);
const CREAM_END_X = 1230; // right edge of the last cream letter (k)
const RULE_X0 = 371;
const RULE_X1 = 1204;
const DOT = { cx: 1270, cy: 328, r: 26 };

/* ---------- Timeline (fractions of the scroll track) ---------- */
const T = {
  draw: [0, 0.34],
  rise: [0.34, 0.52],
  dotPop: [0.52, 0.58],
  tagline: [0.5, 0.6],
  expand: [0.62, 0.82],
  orangeHeader: 0.8,
  words: [0.84, 0.96],
} as const;
const REDUCED_P = 0.6; // reduced motion: logo fully drawn, no takeover

type HeroEls = {
  clip: SVGRectElement;
  mask: SVGPathElement;
  dot: SVGGElement;
  tagline: SVGTextElement;
};

/** The logo draws, the orange climbs the right side of the last i, the dot pops in. */
function applyHero(el: HeroEls, p: number) {
  const draw = easeOutExpo(seg(p, T.draw[0], T.draw[1]));
  // Letters wipe in left to right, level with the head of the rule.
  el.clip.setAttribute("width", String(Math.max(0, draw * (CREAM_END_X + 10 - VB.x))));

  // The orange follows its centreline: the rule first, then the corner and the stem.
  const rise = quadInOut(seg(p, T.rise[0], T.rise[1]));
  const along = draw * RULE_SHARE + rise * (1 - RULE_SHARE);
  el.mask.style.strokeDashoffset = String(1000 * (1 - along));

  const pop = seg(p, T.dotPop[0], T.dotPop[1]);
  el.dot.style.transform = `scale(${pop <= 0 ? 0 : easeOutBack(pop)})`;

  el.tagline.style.opacity = String(seg(p, T.tagline[0], T.tagline[1]));
}

/** The small header lockup is static: the same logo, no tagline. */
function HeaderLogo() {
  return (
    <svg viewBox={`${VB.x} ${VB.y} ${VB.w} 320`} className="k-header-logo" role="img" aria-label="kebiki">
      <path d={CREAM_PATH} className="k-h-cream" />
      <path d={ORANGE_PATH} className="k-h-orange" />
      <path d={DOT_PATH} className="k-h-orange" />
    </svg>
  );
}

export function MotionHome() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduce);
    const cleanups: (() => void)[] = [];
    const root = rootRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    const svg = svgRef.current;
    const hint = hintRef.current;
    const overlay = overlayRef.current;
    if (!root || !track || !stage || !svg || !hint || !overlay) return;

    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!;
    const els: HeroEls = {
      clip: q<SVGRectElement>("#k-clip-rect"),
      mask: q<SVGPathElement>("#k-mask-path"),
      dot: q<SVGGElement>(".k-svg-dot"),
      tagline: q<SVGTextElement>(".k-svg-tagline"),
    };

    /* Where the final dot sits on screen, measured once per layout (not per frame). */
    const geo = { cx: 0, cy: 0, r0: 0, R: 0 };
    const measure = () => {
      const s = svg.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      const scale = s.width / VB.w;
      geo.cx = s.left - st.left + (DOT.cx - VB.x) * scale;
      geo.cy = s.top - st.top + (DOT.cy - VB.y) * scale;
      geo.r0 = DOT.r * scale;
      geo.R = Math.hypot(Math.max(geo.cx, st.width - geo.cx), Math.max(geo.cy, st.height - geo.cy)) + 8;
    };
    measure();

    /* Development only: ?p=0.7 freezes the animation at that point, for screenshots. */
    const forcedRaw =
      process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("p") : null;
    const forced = forcedRaw !== null && Number.isFinite(Number(forcedRaw)) ? clamp01(Number(forcedRaw)) : null;

    /* Scroll-scrubbed with lerp smoothing. */
    let target = forced ?? (reduce ? REDUCED_P : 0);
    let shown = target;
    let raf = 0;
    const readScroll = () => {
      if (reduce || forced !== null) return;
      const r = track.getBoundingClientRect();
      target = clamp01(-r.top / (r.height - window.innerHeight));
    };
    const onResize = () => {
      measure();
      readScroll();
    };
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", onResize);
    readScroll();

    const wordEls = wordRefs.current.filter((w): w is HTMLSpanElement => !!w);

    const loop = () => {
      shown += (target - shown) * (reduce || forced !== null ? 1 : 0.1);
      if (Math.abs(target - shown) < 0.0005) shown = target;
      const p = shown;

      applyHero(els, p);
      hint.style.opacity = p > 0.04 ? "0" : "1";

      /* The dot becomes the screen: a circle clip grows from the dot's own size and position. */
      const e = reduce ? 0 : quadInOut(seg(p, T.expand[0], T.expand[1]));
      if (e <= 0) {
        overlay.style.display = "none";
      } else {
        overlay.style.display = "block";
        const r = geo.r0 + e * (geo.R - geo.r0);
        overlay.style.clipPath = `circle(${r}px at ${geo.cx}px ${geo.cy}px)`;
      }

      root.classList.toggle("k-orange", !reduce && p > T.orangeHeader);

      /* The sentence arrives word by word on the orange. */
      const span = T.words[1] - T.words[0];
      wordEls.forEach((w, i) => {
        const start = T.words[0] + (i / WORDS.length) * span * 0.8;
        const local = quadInOut(seg(p, start, start + span * 0.2));
        w.style.opacity = String(local);
        w.style.transform = `translateY(${(1 - local) * 0.5}em)`;
      });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    cleanups.push(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", onResize);
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <main id="main" ref={rootRef} className={`kmotion ${garamond.className}`}>
      <header className="k-header">
        <HeaderLogo />
      </header>

      <section ref={trackRef} className="k-track" style={reduced ? { height: "100vh" } : undefined}>
        <div ref={stageRef} className="k-stage">
          <div className={`k-hero ${montserrat.className}`} role="img" aria-label={`kebiki. ${TAGLINE}`}>
            <svg ref={svgRef} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} aria-hidden="true">
              <defs>
                <clipPath id="k-clip">
                  <rect id="k-clip-rect" x={VB.x} y="0" width="0" height="900" />
                </clipPath>
                <mask id="k-mask" maskUnits="userSpaceOnUse" x={VB.x} y={VB.y} width={VB.w} height={VB.h}>
                  <path
                    id="k-mask-path"
                    d={ORANGE_CENTRELINE}
                    pathLength="1000"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="48"
                    strokeDasharray="1000"
                    strokeDashoffset="1000"
                  />
                </mask>
              </defs>
              <g clipPath="url(#k-clip)">
                <path d={CREAM_PATH} className="k-svg-cream" />
              </g>
              <g mask="url(#k-mask)">
                <path d={ORANGE_PATH} className="k-svg-orange" />
              </g>
              <g className="k-svg-dot">
                <path d={DOT_PATH} className="k-svg-orange" />
              </g>
              <text
                className="k-svg-tagline"
                x={RULE_X0}
                y="672"
                fontSize="35"
                textLength={RULE_X1 + 93 - RULE_X0}
                lengthAdjust="spacing"
                opacity="0"
              >
                {TAGLINE}
              </text>
            </svg>
          </div>
          <div ref={hintRef} className="k-label k-hint">scroll ↓</div>

          <div ref={overlayRef} className="k-overlay" aria-hidden="true" />
          {!reduced ? (
            <div className="k-final">
              <p>
                <span className="k-sr">{SENTENCE}</span>
                {WORDS.map((w, i) => (
                  <span key={i} aria-hidden="true">
                    <span className="k-w" ref={(el) => { wordRefs.current[i] = el; }}>{w}</span>
                    {i < WORDS.length - 1 ? " " : ""}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {reduced ? (
        <section className="k-static">
          <p>{SENTENCE}</p>
        </section>
      ) : null}
    </main>
  );
}
