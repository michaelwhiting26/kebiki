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
  tagline: [0.5, 0.53],
  expand: [0.62, 0.82],
  orangeHeader: 0.8,
  words: [0.84, 0.96],
} as const;
const REDUCED_P = 0.6; // reduced motion: logo fully drawn, no takeover
/** Share of the scroll track the animation plays over; the rest holds the finished sentence. */
const HOLD = 0.9;

/** Box-drawing characters and plus signs that move through the tagline before it resolves. */
const SCRAMBLE_GLYPHS = "+─│┼┬┴├┤╴╵╶╷".split("");
const SVG_NS = "http://www.w3.org/2000/svg";

/** The next screen, in the studio's own words (from the main site's capabilities). */
const NEXT_ITEMS = [
  { n: "01", verb: "Define", text: "Work out what the business is trying to achieve, who it is for, what limits it and how success gets measured." },
  { n: "02", verb: "Design", text: "Shape the interface, the way information is organised and the system underneath it together - not as separate jobs passed between teams." },
  { n: "03", verb: "Build", text: "Ship in working pieces, each one tested and monitored from the day it goes live." },
  { n: "04", verb: "Evolve", text: "Keep improving the product against what real use shows and what the business needs next." },
] as const;
const CONTACT_EMAIL = "hello@kebiki.studio";

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

/**
 * Splits the SVG tagline into one positioned tspan per character, measured from the finished
 * layout, so swapping glyphs while scrambling never shifts anything. Spaces get no tspan.
 */
function splitTagline(text: SVGTextElement): { cell: SVGTSpanElement | null; ch: string }[] {
  const chars = [...TAGLINE];
  const xs = chars.map((_, i) => text.getStartPositionOfChar(i).x);
  text.removeAttribute("textLength");
  text.removeAttribute("lengthAdjust");
  text.textContent = "";
  return chars.map((ch, i) => {
    if (ch === " ") return { cell: null, ch };
    const t = document.createElementNS(SVG_NS, "tspan");
    t.setAttribute("x", String(xs[i]));
    t.textContent = ch;
    text.appendChild(t);
    return { cell: t, ch };
  });
}

/** Scrambled characters resolve left to right (about 16 fps), unresolved ones in the logo's orange. */
function runTaglineScramble(cells: { cell: SVGTSpanElement | null; ch: string }[], duration = 1.6) {
  const n = cells.length;
  const t0 = performance.now();
  const step = 1000 / 16;
  let last = 0;
  let raf = 0;
  const paint = (t: number) => {
    const resolved = Math.round(quadInOut(clamp01(t)) * n);
    cells.forEach((c, i) => {
      if (!c.cell) return;
      const done = i < resolved;
      c.cell.textContent = done ? c.ch : SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
      c.cell.setAttribute("class", done ? "" : "k-g");
    });
  };
  paint(0);
  const tick = (now: number) => {
    if (now - last < step) {
      raf = requestAnimationFrame(tick);
      return;
    }
    last = now;
    const t = clamp01((now - t0) / 1000 / duration);
    paint(t);
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Puts every tagline character back to its real glyph. */
function settleTagline(cells: { cell: SVGTSpanElement | null; ch: string }[]) {
  cells.forEach((c) => {
    if (!c.cell) return;
    c.cell.textContent = c.ch;
    c.cell.setAttribute("class", "");
  });
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

/** The first word of the sentence, drawn as the logo: ink on the orange, sitting on the text baseline. */
function InlineLogo() {
  return (
    <svg viewBox="366 298 934 304" className="k-inline-logo" role="img" aria-hidden="true">
      <path d={CREAM_PATH} />
      <path d={ORANGE_PATH} />
      <path d={DOT_PATH} />
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

    /* The tagline becomes positioned characters once the font has loaded, so it can scramble. */
    let cells: { cell: SVGTSpanElement | null; ch: string }[] | null = null;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled && !cells) cells = splitTagline(els.tagline);
    });
    cleanups.push(() => {
      cancelled = true;
    });
    let scrambled = false;
    let stopScramble: (() => void) | null = null;
    cleanups.push(() => stopScramble?.());

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
    let trackBottom = Infinity;
    const readScroll = () => {
      if (reduce || forced !== null) return;
      const r = track.getBoundingClientRect();
      trackBottom = r.bottom;
      target = clamp01(-r.top / (r.height - window.innerHeight) / HOLD);
    };
    const onResize = () => {
      measure();
      readScroll();
    };
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", onResize);
    readScroll();

    /* The next screen's rows rise in as they scroll into view. */
    const rows = [...root.querySelectorAll<HTMLElement>(".k-next-row")];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (e.target as HTMLElement).dataset.in = "1";
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    rows.forEach((r) => io.observe(r));
    cleanups.push(() => io.disconnect());

    const wordEls = wordRefs.current.filter((w): w is HTMLSpanElement => !!w);

    const loop = () => {
      shown += (target - shown) * (reduce || forced !== null ? 1 : 0.1);
      if (Math.abs(target - shown) < 0.0005) shown = target;
      const p = shown;

      applyHero(els, p);

      // The tagline scrambles every time the scroll passes into its window, forwards or after
      // scrolling back above it, not just the first time.
      if (cells) {
        if (!scrambled && p >= T.tagline[0]) {
          scrambled = true;
          stopScramble?.();
          stopScramble = reduce ? null : runTaglineScramble(cells);
          if (reduce) settleTagline(cells);
        } else if (scrambled && p < T.tagline[0] - 0.015) {
          scrambled = false; // re-arm: the next pass through plays it again
          stopScramble?.();
          stopScramble = null;
          settleTagline(cells);
        }
      }
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

      // The header logo is ink on the orange screen, and cream again once the page goes dark.
      root.classList.toggle("k-orange", !reduce && p > T.orangeHeader && trackBottom > 72);

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
                    <span className="k-w" ref={(el) => { wordRefs.current[i] = el; }}>{i === 0 ? <InlineLogo /> : w}</span>
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
          <p>
            <InlineLogo /> {WORDS.slice(1).join(" ")}
          </p>
        </section>
      ) : null}

      <section id="next" className="k-next">
        <div className="k-label">What we do</div>
        <ol className="k-next-list">
          {NEXT_ITEMS.map((it) => (
            <li key={it.n} className="k-next-row">
              <span className="k-next-n">{it.n}</span>
              <h2 className="k-next-verb">{it.verb}</h2>
              <p className="k-next-text">{it.text}</p>
            </li>
          ))}
        </ol>
        <div className="k-next-contact k-next-row">
          <div className="k-label">Contact</div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="k-next-mail">
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>
    </main>
  );
}
