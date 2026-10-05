"use client";

import { EB_Garamond, Montserrat } from "next/font/google";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CREAM_PATH, DOT_PATH, ORANGE_PATH } from "./logo-paths";
import { BRAND_ICONS, type BrandIcon } from "./brand-icons";
import { BOOKING_URL, CONTACT_EMAIL, SOCIAL_LINKS, WHATSAPP_URL } from "./contact-config";
import { COUNTRY_SHAPES } from "./country-paths";
import { InteractiveDotMap } from "./dot-map";
import { addScene, addTick, documentTop, setLenis, type FrameState } from "./clock";
import { ScrollField } from "./scroll-field";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import "./motion.css";

/** The logo's letters in liquid metal, loaded on its own so the shader is not in the first download. */
const LiquidLogo = dynamic(() => import("./liquid-logo"), { ssr: false });

/** The sentence's serif. */
const garamond = EB_Garamond({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
/** The tagline's geometric sans, set wide like the supplied logo. */
const montserrat = Montserrat({ subsets: ["latin"], weight: ["500"], display: "swap" });

const TAGLINE = "complex digital products, built to last.";
const SENTENCE =
  "Bring us the complicated idea. We'll challenge it, test the hardest part first, and build the version worth building.";
const WORDS = SENTENCE.split(" ");
/** The opening statement ("Bring us the complicated idea.") is set larger, on its own line. */
const HEAD_WORDS = 5;

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
/**
 * A brief resistance while the orange circle sweeps past the left edge, so its arc and the logo
 * hold on screen for a moment. Slows the expansion around DWELL.at (in expansion progress) to
 * DWELL.slow of its speed at the centre, and makes it up either side; the start and end are unchanged.
 */
const DWELL = { at: 0.65, width: 0.2, slow: 0.9 } as const;
function dwell(u: number) {
  const d = u - DWELL.at;
  if (Math.abs(d) >= DWELL.width) return u;
  return u - ((DWELL.slow * DWELL.width) / Math.PI) * Math.sin((Math.PI * d) / DWELL.width);
}
const REDUCED_P = 0.6; // reduced motion: logo fully drawn, no takeover
/**
 * The scroll track, in viewport heights (matches .k-track in motion.css), and how it is spent:
 * the logo and the orange takeover play over PLAY_VH, the sentence then settles out of Japanese over
 * SETTLE_VH, the seal writes itself over SEAL_VH, and what is left holds the finished screen.
 */
const TRACK_VH = 300;
const PLAY_VH = 117;
const SETTLE_VH = 70;
/** Scroll, in viewport heights, over which the seal writes itself once the sentence has settled. */
const SEAL_VH = 26;
/** The seal's characters, top to bottom. */
const SEAL_CHARS = ["罫", "引", "き"] as const;
/** How long the logo waits for its metal before falling back to the flat letters (ms). */
const METAL_WAIT_MS = 2600;
/** On load the logo builds by itself up to the finished mark; scrolling then plays the rest. */
const INTRO = { end: T.dotPop[1], delay: 300, ms: 2500 };

/** Box-drawing characters and plus signs that move through the tagline before it resolves. */
const SCRAMBLE_GLYPHS = "+─│┼┬┴├┤╴╵╶╷".split("");
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * How an engagement starts, in three blocks: the first conversation, the four routes that can follow
 * it, and the 14-day sprint in detail. Wording is a draft of commercial terms.
 */
const HOW = {
  consult: {
    label: "Initial consultation",
    lead: "You do not need a finished brief.",
    heading: ["Start with the problem.", "We\u2019ll challenge the rest."],
    points: [
      { title: "Understand the outcome", text: "What the business is trying to achieve, who it is for and why it matters now." },
      { title: "Expose the assumptions", text: "What is known, what is guessed and what could make the whole idea fail." },
      { title: "Choose the next move", text: "Advice, a sprint, a scoped build - or a recommendation not to build yet." },
    ],
    cta: "Book a 30-minute conversation",
    ctaNote: "Talk your idea through with the people who would build it.",
  },
  routes: {
    label: "What happens next",
    lead: "Once the problem is clear, we recommend the smallest engagement that can answer the next expensive question.",
    items: [
      { n: "01", title: "Need an answer", text: "Architecture reviews, technical due diligence, product advice or an independent read on a build already in progress.", tag: "Consultation / advisory", href: "" },
      { n: "02", title: "Need to prove it", text: "When the important unknowns still need evidence, we define, design and build enough of the product to make a confident decision.", tag: "14-day sprint", href: "#sprint" },
      { n: "03", title: "Know what needs building", text: "A defined product or workstream with clear outcomes, delivered on an agreed commercial model and written scope.", tag: "Scoped delivery", href: "" },
      { n: "04", title: "Have something live", text: "Reserved senior product and engineering capacity for a product that needs to keep moving after launch.", tag: "Ongoing product work", href: "" },
    ],
  },
  sprint: {
    label: "When uncertainty is the problem",
    lead: "The 14-day sprint is usually the right next step when committing to the whole build would still mean guessing.",
    steps: [
      { n: "01", days: "Day 01 - 02", verb: "Define", text: "Work out what the business is actually trying to achieve, who it is for, what limits it and how success gets measured.", output: "The problem, restated", outputText: "A precise definition everyone involved can agree on." },
      { n: "02", days: "Day 03 - 05", verb: "Design", text: "Shape the interface, information and system together - not as separate jobs passed between teams.", output: "The constraint map", outputText: "What we know, what we assume and what still needs an answer." },
      { n: "03", days: "Day 06 - 09", verb: "Build", text: "Build the part that creates the most useful evidence first. Real software exposes problems that workshops cannot.", output: "A working first version", outputText: "One important part, built end to end and deployed." },
      { n: "04", days: "Day 10 - 14", verb: "Decide", text: "Turn what we learned into a written recommendation with the real trade-offs, risks, cost drivers and next steps.", output: "The decision", outputText: "A plan another capable team could execute without us." },
    ],
    outcome: ["You leave with a decision.", "Not another deck."],
    ownership: "Every output is yours, whether we continue together or not. No lock-in. No dependency. No obligation.",
  },
} as const;

/**
 * Selected work, in the studio's own words (from the Quadrum site). Deliberately no headline figures,
 * no named partners or integrations, and no logos: only what can be shown running.
 */
/** One item in a work entry's stack. `icon` is set only for a named technology with its own mark. */
type StackItem = { name: string; icon?: BrandIcon };

const WORK = [
  {
    n: "01",
    category: "Multi-chain payments",
    name: "Pepay",
    text: "Accept any supported asset and settle from one system - invoicing, payment links, QR checkout, subscriptions and reconciliation on the same ledger.",
    stack: [{ name: "React", icon: "react" }, { name: "TypeScript", icon: "typescript" }, { name: "Solana", icon: "solana" }, { name: "BNB Chain", icon: "bnbchain" }] as StackItem[],
    href: "https://pepay.io",
  },
  {
    n: "02",
    category: "Trading infrastructure",
    name: "DRK",
    text: "Tokenisation solved issuance. It did not solve liquidity: it makes an asset digital without making it easy to trade. DRK is the layer between tokenised assets and the institutions that trade them.",
    stack: [{ name: "TypeScript", icon: "typescript" }, { name: "React", icon: "react" }, { name: "EVM" }, { name: "Trading infrastructure" }] as StackItem[],
    href: "https://drk-deck.vercel.app/",
  },
  {
    n: "03",
    category: "Programmable payments",
    name: "BNBPay",
    text: "Payments that move on-chain without the payer covering blockchain fees - invoices, subscriptions, gift cards and API payments for merchants, platforms and AI agents across BNB Chain and opBNB.",
    stack: [{ name: "Solidity", icon: "solidity" }, { name: "TypeScript", icon: "typescript" }, { name: "Next.js", icon: "nextjs" }, { name: "BNB Chain", icon: "bnbchain" }] as StackItem[],
    href: "https://bnbpay.org",
  },
  {
    n: "04",
    category: "Property marketing",
    name: "Linton Villas",
    text: "We built the experience the developer sells through: masterplan, villa types, floor plans, financial projections, an eight-minute film and the full prospectus, as one guided journey.",
    stack: [{ name: "Strategy" }, { name: "UX/UI" }, { name: "Next.js", icon: "nextjs" }, { name: "Interactive media" }] as StackItem[],
    href: "https://lintonvillas.vercel.app",
  },
  {
    n: "05",
    category: "Sports media platform",
    name: "Combat Reviews",
    text: "Events, fight cards, rankings, athlete profiles and predictions for combat sports, from announcement through to result.",
    stack: [{ name: "Next.js", icon: "nextjs" }, { name: "TypeScript", icon: "typescript" }, { name: "Postgres", icon: "postgres" }, { name: "Prisma", icon: "prisma" }] as StackItem[],
    href: "",
  },
  {
    n: "06",
    category: "Enterprise AI",
    name: "Noise",
    text: "One place for a team's email, chats, meetings and documents. Everything the team works in is brought together and indexed, so context is found in seconds instead of hunted across disconnected systems.",
    stack: [{ name: "React", icon: "react" }, { name: "Fastify", icon: "fastify" }, { name: "Postgres", icon: "postgres" }, { name: "Vector search" }] as StackItem[],
    href: "https://noiselanding.vercel.app/",
  },
] as const;

/** Sits under the work list: says whose work it is, and whose names they are. */
const WORK_NOTE = "Selected work by the Kebiki team. Product names and brands belong to their respective owners.";

/** A live product shows its own domain; a build still on a preview host says so plainly. */
function workLinkLabel(href: string) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  return host.endsWith(".vercel.app") ? "View the build" : `Visit ${host}`;
}

/** The work roller: degrees between neighbouring names on the drum, and scroll per project (in screens). */
const ROLLER = { step: 24, perItem: 0.4 } as const;

/** Where a name sits on the drum, `d` places from the front (negative is above). */
function rollerStyle(d: number) {
  return {
    transform: `rotateX(${(-d * ROLLER.step).toFixed(2)}deg) translateZ(var(--k-roller-r))`,
    opacity: Math.pow(clamp01(1 - Math.abs(d) / 2.4), 1.6).toFixed(3),
  };
}

/**
 * Selected work on a vertical roller. The screen sticks while the visitor scrolls: the project names
 * turn on a drum, one place per project, and the details beside it follow the name at the front.
 * On phones the drum sits above the details, one project at a time. With reduced motion there is no
 * drum and nothing sticks: the projects read as a plain list (see motion.css).
 */
function WorkRoller() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const names = [...track.querySelectorAll<HTMLElement>(".k-roller-name")];
    const panels = [...track.querySelectorAll<HTMLElement>(".k-roller-panel")];
    /* The track's place in the document, measured when the layout changes; each frame is arithmetic. */
    let top = 0;
    let height = 0;
    let lastPos = NaN;
    return addScene({
      measure() {
        // The track itself is never transformed, so its rectangle gives its exact (fractional) size.
        const r = track.getBoundingClientRect();
        top = r.top + window.scrollY;
        height = r.height;
        lastPos = NaN;
      },
      update({ scroll, vh }) {
        const span = height - vh;
        const raw = (span > 0 ? clamp01((scroll - top) / span) : 0) * (names.length - 1);
        // Settle on each project: slow near a whole place, quicker in between.
        const f = raw - Math.floor(raw);
        const pos = Math.floor(raw) + f * f * (3 - 2 * f);
        if (pos === lastPos) return; // nothing has moved: write nothing
        lastPos = pos;
        const active = Math.round(pos);
        names.forEach((el, i) => {
          Object.assign(el.style, rollerStyle(i - pos));
          el.toggleAttribute("data-active", i === active);
        });
        panels.forEach((el, i) => el.toggleAttribute("data-active", i === active));
      },
    });
  }, []);

  return (
    <div ref={trackRef} className="k-roller-track" style={{ height: `${100 + (WORK.length - 1) * ROLLER.perItem * 100}vh` }}>
      <div className="k-roller-stage">
        <div className="k-label">Selected work</div>
        <div className="k-roller-body">
          <div className="k-roller-drum" aria-hidden="true">
            <div className="k-roller-wheel">
              {WORK.map((w, i) => (
                <span key={w.name} className="k-roller-name" style={rollerStyle(i)} data-active={i === 0 ? "" : undefined}>
                  {w.name}
                </span>
              ))}
            </div>
          </div>
          <ol className="k-roller-panels">
            {WORK.map((w, i) => (
              <li key={w.name} className="k-roller-panel" data-active={i === 0 ? "" : undefined}>
                <div className="k-work-meta">
                  <span className="k-work-n">{w.n}</span>
                  <span className="k-work-cat">{w.category}</span>
                </div>
                <h2 className="k-roller-panel-name">{w.name}</h2>
                <p className="k-work-text">{w.text}</p>
                <ul className="k-work-stack" aria-label="Built with">
                  {w.stack.map((st) => (
                    <li key={st.name}>
                      {st.icon ? (
                        <svg viewBox="0 0 24 24" className="k-stack-icon" aria-hidden="true">
                          <path d={BRAND_ICONS[st.icon].path} />
                        </svg>
                      ) : null}
                      {st.name}
                    </li>
                  ))}
                </ul>
                {w.href ? (
                  <a href={w.href} className="k-work-link" target="_blank" rel="noopener noreferrer">
                    {workLinkLabel(w.href)}<span aria-hidden="true"> &rarr;</span>
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * Client words, exactly as given and approved in writing by the person quoted. Empty until then:
 * the block below the work list only appears once there is at least one.
 */
const TESTIMONIALS: { quote: string; name: string; role: string; company: string }[] = [];

/** Layout example for local preview only: never shown on the live site, where a made-up quote would be fake proof. */
const QUOTES_SHOWN =
  TESTIMONIALS.length > 0 || process.env.NODE_ENV === "production"
    ? TESTIMONIALS
    : [
        {
          quote: "Example only - the client's own words go here, two or three sentences on what changed for them.",
          name: "Client Name",
          role: "Role",
          company: "Company",
        },
      ];

/** The people you meet. Surnames show only once all three are filled in, so nobody stands out. */
const TEAM = [
  {
    name: "Michael",
    image: "/team/michael.jpg",
    cover: 77,
    surname: "Whiting",
    linkedin: "",
    role: "Engineering & Delivery",
    bio: "Michael is a full-stack engineer with a background in international arbitration. If he\u2019s asking difficult questions, relax. He\u2019s on your side.",
    talk: "scope, pricing, contracts & getting it over the line",
  },
  {
    name: "Marc",
    image: "/team/marc.jpg",
    cover: 84,
    surname: "",
    linkedin: "",
    role: "Full-Stack Engineering",
    bio: "Marc has been writing code since the womb and builds across the whole stack like it\u2019s muscle memory. He is, as far as we can tell, a genetic anomaly who doesn\u2019t sleep. If he goes quiet, don\u2019t worry. He\u2019s cooking.",
    talk: "architecture, data & keeping things alive in production",
  },
  {
    name: "Riki",
    image: "/team/riki.jpg",
    cover: 80,
    surname: "",
    linkedin: "",
    role: "Engineering & Growth",
    bio: "Riki is a full-stack engineer who brings a week\u2019s worth of energy to Monday morning. He builds products, then gets them growing.",
    talk: "building, launching & finding traction",
  },
] as const;
const SHOW_SURNAMES = TEAM.every((m) => m.surname.trim() !== "");
const fullName = (m: (typeof TEAM)[number]) => (SHOW_SURNAMES ? `${m.name} ${m.surname}` : m.name);
/** The fade to the page's black starts just above each portrait's collarbone. */
const coverStyle = (m: { cover: number }) => ({ ["--cover" as string]: `${m.cover}%` }) as React.CSSProperties;

const TEAM_COPY = {
  label: "The studio",
  title: "The people you meet are the people who build.",
  body: "The same team, from first idea to finished product.",
} as const;

/**
 * How we charge, on the home page: a headline and one line on how work is priced. The five
 * commercial models that line refers to live on /terms (see terms-data.ts).
 * Wording is a draft of commercial terms.
 */
const TERMS = {
  label: "How we charge",
  heading: "You know the price before the work starts.",
  after: { text: "Fixed price, capped, retainer or equity, agreed in writing.", link: "The five ways to work with us" },
} as const;

const SERVICES = [
  "Product strategy",
  "Brand identity",
  "Product design",
  "3D & product visualisation",
  "Web & app development",
  "AI & automation",
  "Blockchain & payments",
  "Design systems",
] as const;
const SECTORS = ["Fintech & payments", "Crypto & Web3", "Sport & media", "Construction & infrastructure", "Enterprise software"] as const;
const CONTACT_COPY = {
  title: "Bring us the hard part.",
  body: "The harder it is to build, the more interested we are.",
  cta: "Start a conversation",
  /** The contact screen's own button. The short label above stays on the corner button and elsewhere. */
  action: "Tell us what you\u2019re building",
} as const;

type HeroEls = {
  clip: SVGRectElement;
  mask: SVGPathElement;
  dot: SVGGElement;
  tagline: SVGTextElement;
  metal: HTMLElement | null;
};

/** The logo draws, the orange climbs the right side of the last i, the dot pops in. */
function applyHero(el: HeroEls, p: number) {
  const draw = easeOutExpo(seg(p, T.draw[0], T.draw[1]));
  // Letters wipe in left to right, level with the head of the rule.
  el.clip.setAttribute("width", String(Math.max(0, draw * (CREAM_END_X + 10 - VB.x))));
  // The metal the letters are made of wipes in with them, to the same edge.
  if (el.metal) {
    const shown = (draw * (CREAM_END_X + 10 - VB.x)) / VB.w;
    el.metal.style.clipPath = draw >= 1 ? "none" : `inset(0 ${((1 - shown) * 100).toFixed(2)}% 0 0)`;
  }

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
  const stop = addTick(({ time: now }) => {
    if (now - last < step) return;
    last = now;
    const t = clamp01((now - t0) / 1000 / duration);
    paint(t);
    if (t >= 1) stop();
  });
  return stop;
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

const CITIES = [
  { name: "Dubai", zone: "Asia/Dubai", country: "uae" },
] as const;

/** The studio's cities, each with its country's outline and the local time (updating each minute). Times render after mount, so server and client agree. */
function CityClocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <ul className="k-cities" aria-label="Where we work from">
      {CITIES.map((c) => {
        const shape = COUNTRY_SHAPES[c.country];
        return (
          <li key={c.name} className="k-city">
            {/* The words sit in the open corner above the low side of the map; the map fills the row. */}
            <div className="k-city-text">
              <span className="k-city-name">{c.name}</span>
              <span className="k-city-time" suppressHydrationWarning>
                {now
                  ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: c.zone }).format(now)
                  : "\u00a0"}
              </span>
              <span className="k-city-note">Operating internationally</span>
            </div>
            <div className="k-city-shape">
              <InteractiveDotMap d={shape.d} w={shape.w} h={shape.h} label={`Map of ${shape.name}`} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Ways to talk now: a booked call and WhatsApp. Each button exists only if its channel is configured. */
function ContactActions() {
  return (
    <div className="k-contact-actions">
      <a href={`mailto:${CONTACT_EMAIL}`} className="k-cta k-cta-solid">
        {CONTACT_COPY.action}<span aria-hidden="true"> &rarr;</span>
      </a>
      {BOOKING_URL ? (
        <a href={BOOKING_URL} className="k-cta-link" target="_blank" rel="noopener noreferrer">
          Book a call<span className="k-cta-arrow" aria-hidden="true">&rarr;</span>
        </a>
      ) : null}
      {WHATSAPP_URL ? (
        <a href={WHATSAPP_URL} className="k-cta-link" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" className="k-cta-icon" aria-hidden="true">
            <path d={BRAND_ICONS.whatsapp.path} />
          </svg>
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}

/** The email as a link plus a one-click copy, for people without a mail app set up. */
function ContactEmail() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard blocked: the mailto link above still works. */
    }
  };
  return (
    <div className="k-contact-email">
      <a href={`mailto:${CONTACT_EMAIL}`} className="k-contact-mail">
        {CONTACT_EMAIL}
      </a>
      <button type="button" className="k-copy" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy address"}
      </button>
    </div>
  );
}

/**
 * The team, in an order that belongs to no one. Each visit starts at a random person, and the
 * lead then rotates every few seconds, so everybody passes through it equally.
 *  - Wide screens: three equal portraits on a conveyor that slides one place at a time.
 *  - Phones: all three on screen at once, one in detail and the other two as small thumbnails;
 *    tapping a thumbnail brings that person forward.
 * It pauses under a mouse pointer or keyboard focus, and never moves for reduced-motion visitors.
 */
function TeamRotator() {
  const [order, setOrder] = useState<number[]>(() => TEAM.map((_, i) => i));
  const [ready, setReady] = useState(false);
  const [shifting, setShifting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [compact, setCompact] = useState(false);

  // Before the first paint: pick a random starting person (the server cannot, it renders once).
  useLayoutEffect(() => {
    const start = Math.floor(Math.random() * TEAM.length);
    setOrder(TEAM.map((_, i) => (i + start) % TEAM.length));
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const mq = window.matchMedia("(max-width: 640px)");
    setCompact(mq.matches);
    const onChange = () => {
      setCompact(mq.matches);
      setShifting(false);
    };
    mq.addEventListener("change", onChange);
    setReady(true);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!ready || reduceMotion || paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      // Phones swap the featured person directly; wide screens slide the conveyor.
      if (compact) setOrder((o) => [...o.slice(1), o[0]]);
      else setShifting(true);
    }, 5200);
    return () => window.clearInterval(id);
  }, [ready, reduceMotion, paused, compact]);

  // When the slide finishes, rotate the underlying order and reset the track with no transition.
  const onTransitionEnd = (e: React.TransitionEvent<HTMLUListElement>) => {
    if (e.target !== e.currentTarget || !shifting) return;
    setOrder((o) => [...o.slice(1), o[0]]);
    setShifting(false);
  };

  /** Bring one person to the front, keeping the others in their cyclic order. */
  const feature = (idx: number) =>
    setOrder((o) => {
      const at = o.indexOf(idx);
      return at <= 0 ? o : [...o.slice(at), ...o.slice(0, at)];
    });

  // Only a real mouse pauses it: a tap must not leave it stuck paused.
  const hover = (on: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setPaused(on);
  };

  const lead = TEAM[order[0]];
  return (
    <div
      className="k-team-viewport"
      data-ready={ready ? "1" : undefined}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {compact ? (
        <div className="k-team-stack">
          <div className="k-team-feature k-team-frame" key={lead.name} style={coverStyle(lead)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.image}
              alt={`Illustrated portrait of ${lead.name}`}
              width={880}
              height={1100}
              decoding="async"
              className="k-team-img"
            />
            <span className="k-team-name">{fullName(lead)}</span>
          </div>
          <div className="k-team-thumbs">
            {order.slice(1).map((idx) => {
              const m = TEAM[idx];
              return (
                <button
                  key={m.name}
                  type="button"
                  className="k-team-thumb k-team-frame"
                  style={coverStyle(m)}
                  onClick={() => feature(idx)}
                  aria-label={`Show ${m.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt="" width={880} height={1100} decoding="async" className="k-team-img" />
                  <span className="k-team-thumb-name">{m.name}</span>
                </button>
              );
            })}
          </div>
          <div className="k-team-detail" key={`${lead.name}-detail`}>
            <span className="k-team-role">{lead.role}</span>
            <p className="k-team-bio">{lead.bio}</p>
            <p className="k-team-talk">
              <span>Talk to {lead.name} about</span> {lead.talk}
            </p>
            {lead.linkedin ? (
              <a href={lead.linkedin} className="k-team-in" target="_blank" rel="noopener noreferrer">
                LinkedIn<span aria-hidden="true"> &rarr;</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="k-team-track" data-shift={shifting ? "1" : undefined} onTransitionEnd={onTransitionEnd}>
          {/* One extra card on the end gives the slide something to bring in. */}
          {[...order, order[0]].map((idx, pos) => {
            const m = TEAM[idx];
            const isClone = pos === TEAM.length;
            return (
              <li
                key={`${m.name}-${pos}`}
                className="k-team-card k-team-frame"
                style={coverStyle(m)}
                aria-hidden={isClone ? true : undefined}
                tabIndex={isClone ? -1 : 0}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.image}
                  alt={isClone ? "" : `Illustrated portrait of ${m.name}`}
                  width={880}
                  height={1100}
                  loading="lazy"
                  decoding="async"
                  className="k-team-img"
                />
                <div className="k-team-meta">
                  <span className="k-team-name">{fullName(m)}</span>
                  <span className="k-team-role">{m.role}</span>
                  <div className="k-team-more">
                    <div>
                      <p className="k-team-bio">{m.bio}</p>
                      <p className="k-team-talk">
                        <span>Talk to {m.name} about</span> {m.talk}
                      </p>
                      {m.linkedin && !isClone ? (
                        <a href={m.linkedin} className="k-team-in" target="_blank" rel="noopener noreferrer">
                          LinkedIn<span aria-hidden="true"> &rarr;</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The text shuffle from the original studio page: glyphs it cycles through, and how long it takes to settle. */
/**
 * What the sentence is written in before it settles into English: katakana, hiragana and a few
 * kanji from the marking gauge's own trade (rule, pull, line, ink, craft, measure, make).
 */
const SHUFFLE_GLYPHS = [
  ..."アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
  ..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
  ..."罫引線墨匠技形作設計図工木尺寸定規",
];
/** The Japanese is set a little smaller than the Latin so the two sit level (matches .k-w-ja). */
const JA_SCALE = 0.82;
/**
 * How many times the waiting Japanese is redrawn as the sentence settles. The characters are a
 * function of scroll position, not of time: the same place on the page always shows the same frame.
 */
const SHUFFLE_STEPS = 34;
/** A repeatable pick from the glyph set for one character slot at one step. */
function glyphAt(word: number, slot: number, step: number) {
  let h = Math.imul(word + 1, 374761393) ^ Math.imul(slot + 1, 668265263) ^ Math.imul(step + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return SHUFFLE_GLYPHS[((h ^ (h >>> 16)) >>> 0) % SHUFFLE_GLYPHS.length];
}

/** Characters in the sentence, which the shuffle settles across. */
const SENTENCE_CHARS = SENTENCE.length;

/** Section markers: shown bottom left while each section is on screen. */
const CHAPTERS = [
  { id: "next", label: "How we work" },
  { id: "terms", label: "How we charge" },
  { id: "work", label: "Work" },
  { id: "team", label: "The studio" },
  { id: "contact", label: "Contact" },
] as const;

export function MotionHome() {
  const rootRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState<string | null>(null);

  /* Which section is crossing the middle of the screen, for the chapter marker bottom left. */
  useEffect(() => {
    const ids = CHAPTERS.map((c) => c.id);
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setChapter(e.target.id);
          else setChapter((cur) => (cur === e.target.id ? null : cur));
        });
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /*
   * Smooth wheel and trackpad scrolling (Lenis). It moves the real scroll position, so the sticky
   * hero, observers and the scrollbar keep working. Touch stays native, and visitors who ask for
   * reduced motion get the browser's own scrolling.
   */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.8, smoothWheel: true, syncTouch: false, anchors: true });
    setLenis(lenis); // driven by the page's single clock (./clock)
    return () => {
      setLenis(null);
      lenis.destroy();
    };
  }, []);

  /*
   * Section headlines rise into place a line at a time, each from behind its own edge. GSAP's
   * SplitText finds the lines (and finds them again when the width or the font changes); the motion
   * itself is a CSS transition started by the same "in view" mark as every other row, so nothing
   * here adds a second animation clock. Not done for visitors who ask for reduced motion.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let splits: { revert(): void }[] = [];
    void import("gsap/SplitText").then(({ SplitText }) => {
      if (cancelled) return;
      root.querySelectorAll<HTMLElement>("[data-lines]").forEach((heading) => {
        // A two-sentence headline is split one sentence at a time, so each keeps its own line breaks.
        const parts = heading.querySelectorAll<HTMLElement>(".k-head-line");
        const targets = parts.length ? [...parts] : [heading];
        const number = () => {
          heading.querySelectorAll<HTMLElement>(".k-line").forEach((line, i) => line.style.setProperty("--i", String(i)));
          heading.setAttribute("data-split", "");
        };
        targets.forEach((target) => {
          splits.push(SplitText.create(target, { type: "lines", mask: "lines", linesClass: "k-line", autoSplit: true, onSplit: number }));
        });
      });
    });
    return () => {
      cancelled = true;
      splits.forEach((split) => split.revert());
      splits = [];
    };
  }, []);

  /* A thin bar along the top shows how far through the page the visitor is. */
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    let last = -1;
    return addTick(({ scroll, limit }) => {
      const v = limit > 0 ? clamp01(scroll / limit) : 0;
      if (v === last) return;
      last = v;
      bar.style.transform = `scaleX(${v})`;
    });
  }, []);
  const stepsRef = useRef<HTMLElement>(null);

  /* The four stages: the row nearest the middle of the screen lights up. */
  useEffect(() => {
    const section = stepsRef.current;
    if (!section) return;
    const rows = [...section.querySelectorAll<HTMLElement>(".k-next-list > li")];
    /* Each row's place in the document, measured when the layout changes. */
    let tops: number[] = [];
    let heights: number[] = [];
    let shown = -2;
    return addScene({
      measure() {
        tops = rows.map(documentTop);
        heights = rows.map((r) => r.offsetHeight);
      },
      update({ scroll, vh }) {
        const mid = vh / 2;
        const band = vh * 0.2;
        let active = -1;
        let best = Infinity;
        for (let i = 0; i < rows.length; i++) {
          const top = tops[i] - scroll;
          const bottom = top + heights[i];
          // Only a row that is actually crossing the middle band counts.
          if (top > mid + band || bottom < mid - band) continue;
          const d = Math.abs((top + bottom) / 2 - mid);
          if (d < best) {
            best = d;
            active = i;
          }
        }
        if (active === shown) return;
        shown = active;
        rows.forEach((r, i) => r.toggleAttribute("data-active", i === active));
      },
    });
  }, []);
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sealRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(false);
  /*
   * The logo's letters are liquid metal for as long as the logo is on screen. `metalActive` pauses
   * the flow once the orange has covered it; `metalReady` tells the frame the metal is drawn.
   */
  const heroBoxRef = useRef<HTMLDivElement>(null);
  const metalRef = useRef<HTMLDivElement>(null);
  const metalReady = useRef(false);
  const [metalActive, setMetalActive] = useState(true);
  const onMetalReady = useCallback(() => {
    metalReady.current = true;
    heroBoxRef.current?.setAttribute("data-metal", "on");
  }, []);

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
      metal: metalRef.current,
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
    // Scroll fraction of the track, and the point that scroll position zero stands for: it rises
    // with the opening autoplay, then rests on the finished logo.
    let scrollS = 0;
    let base = 0;
    let introDone = reduce || forced !== null;
    // The logo does not start building until its metal is ready (or the wait runs out), so the
    // letters are never seen in plain cream first.
    const mountedAt = performance.now();
    let introStart: number | null = null;
    const heroBox = heroBoxRef.current;
    let metalShown = true;
    let trackBottom = Infinity;
    let overContact = false;
    const wordEls = wordRefs.current.filter((w): w is HTMLSpanElement => !!w);

    /*
     * Everything the frame needs from the layout, read here and nowhere else: where the track and
     * the contact section sit in the document, how far the animation plays, and each word's width.
     * The clock calls this when the layout changes; the frame itself only does arithmetic.
     */
    let trackTop = 0;
    let trackHeight = 0;
    let playPx = 1;
    let settleFrom = 0; // px into the track where the sentence starts to settle
    let settlePx = 1; // px of scroll it settles over
    let sealPx = 1; // px of scroll the seal writes itself over
    let into = 0; // px scrolled into the track
    let contactTop = Infinity;
    let contactHeight = 0;
    let seenW = -1;
    let seenH = -1;
    const wordWidth: number[] = [];
    const glyphWidth: number[] = [];
    const measureLayout = () => {
      // The dot's position depends only on the viewport, so it is re-read only when that changes.
      if (window.innerWidth !== seenW || window.innerHeight !== seenH) {
        seenW = window.innerWidth;
        seenH = window.innerHeight;
        measure();
      }
      // The track and the contact section are never transformed, so their rectangles are exact.
      const tr = track.getBoundingClientRect();
      trackTop = tr.top + window.scrollY;
      trackHeight = tr.height;
      const vhPx = trackHeight / TRACK_VH;
      playPx = PLAY_VH * vhPx;
      // The words appear at T.words[0] of the animation, which the scroll reaches this far in.
      settleFrom = ((T.words[0] - INTRO.end) / (1 - INTRO.end)) * playPx;
      settlePx = SETTLE_VH * vhPx;
      sealPx = SEAL_VH * vhPx;
      const contact = contactRef.current;
      const cr = contact?.getBoundingClientRect();
      contactTop = cr ? cr.top + window.scrollY : Infinity;
      contactHeight = cr ? cr.height : 0;
      wordEls.forEach((w, i) => {
        const real = w.firstElementChild as HTMLElement | null;
        wordWidth[i] = real ? real.offsetWidth : 0;
        glyphWidth[i] = real ? parseFloat(getComputedStyle(real).fontSize) * JA_SCALE : 1;
      });
    };
    /** Where the page is, from a scroll position and the cached layout. */
    const place = (scroll: number) => {
      const cTop = contactTop - scroll;
      overContact = cTop < 40 && cTop + contactHeight > 40;
      if (reduce || forced !== null) return;
      const top = trackTop - scroll;
      trackBottom = top + trackHeight;
      into = -top;
      scrollS = clamp01(into / playPx);
    };
    measureLayout();
    place(window.scrollY);
    // Arriving part-way down the page (a reload, a #link) skips the intro.
    if (!introDone && scrollS > 0) {
      base = INTRO.end;
      introDone = true;
    }

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

    /* How far the sentence has settled (0 Japanese, 1 English): scroll-driven, smoothed like the hero. */
    let settled = 0;

    /*
     * The seal writes itself by hand (tegaki), one character under the next, as the scroll goes on
     * past the settled sentence. Each character has its own renderer in controlled time: the frame
     * hands it a time and it draws exactly that much ink, so this too is a function of scroll alone.
     */
    let sealed = 0;
    let sealDrawn = -1;
    type Pen = { update(o: { time: number }): void; destroy(): void; readonly duration: number };
    let pens: Pen[] = [];
    const sealBox = sealRef.current;
    const sealCells = sealBox ? [...sealBox.querySelectorAll<HTMLElement>(".k-seal-char")] : [];
    if (!reduce && sealCells.length === SEAL_CHARS.length) {
      void Promise.all([import("tegaki/core"), import("./seal-font")])
        .then(([core, font]) => {
          if (cancelled) return;
          pens = sealCells.map((cell, i) => new core.TegakiEngine(cell, { text: SEAL_CHARS[i], font: font.default, time: 0 }));
          sealBox?.setAttribute("data-written", ""); // the renderer has taken over from the plain text
          sealDrawn = -1;
        })
        .catch(() => {
          /* The plain text stays in place and fades in, as it did before. */
        });
      cleanups.push(() => pens.forEach((pen) => pen.destroy()));
    }

    const wordKey: string[] = [];

    const loop = ({ scroll }: FrameState) => {
      place(scroll);
      const autoplaying = !introDone;
      if (autoplaying) {
        if (introStart === null && (metalReady.current || performance.now() - mountedAt > METAL_WAIT_MS)) {
          introStart = performance.now();
        }
        const t = introStart === null ? 0 : clamp01((performance.now() - introStart - INTRO.delay) / INTRO.ms);
        base = INTRO.end * (1 - Math.pow(1 - t, 2.2));
        if (t >= 1) introDone = true;
        else if (scrollS > 0.0005) {
          // The visitor scrolled first: the smoothing below carries the logo on to finished
          // and straight into the scroll, from wherever the build had reached.
          base = INTRO.end;
          introDone = true;
        }
      }
      // No metal after the wait (no WebGL, or a failed download): show the flat letters instead.
      if (!metalReady.current && heroBox?.dataset.metal === "wait" && performance.now() - mountedAt > METAL_WAIT_MS) {
        heroBox.dataset.metal = "off";
      }
      if (!reduce && forced === null) target = base + scrollS * (1 - base);
      const ease = document.documentElement.classList.contains("lenis") ? 0.35 : 0.1;
      shown += (target - shown) * (reduce || forced !== null || autoplaying ? 1 : ease);
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
      hint.style.opacity = introDone && scrollS < 0.02 ? "1" : "0";

      /* The dot becomes the screen: a circle clip grows from the dot's own size and position. */
      const e = reduce ? 0 : quadInOut(dwell(seg(p, T.expand[0], T.expand[1])));
      if (e <= 0) {
        overlay.style.display = "none";
      } else {
        overlay.style.display = "block";
        const r = geo.r0 + e * (geo.R - geo.r0);
        overlay.style.clipPath = `circle(${r}px at ${geo.cx}px ${geo.cy}px)`;
      }

      // The metal flows only while the logo can be seen: not once the orange has covered it.
      const logoSeen = !reduce && e < 1 && trackBottom > 0;
      if (logoSeen !== metalShown) {
        metalShown = logoSeen;
        setMetalActive(logoSeen);
      }

      // The header logo is ink on the orange screen, and cream again once the page goes dark.
      root.classList.toggle("k-orange", (!reduce && p > T.orangeHeader && trackBottom > 72) || overContact);
      root.classList.toggle("k-past", trackBottom < 72);

      /*
       * The sentence settles out of Japanese into English as the visitor scrolls, left to right
       * across the whole line, and back again if they scroll up. It is driven by scroll position
       * alone, so it cannot be scrolled past unfinished. The scramble is drawn in a clipped layer
       * over the hidden real word, so lines never reflow.
       */
      const wordsOn = p >= T.words[0];
      const settleTarget =
        reduce || !wordsOn ? 0 : forced !== null ? seg(p, T.words[0], T.words[1]) : clamp01((into - settleFrom) / settlePx);
      settled += (settleTarget - settled) * (forced !== null ? 1 : ease);
      if (Math.abs(settleTarget - settled) < 0.0005) settled = settleTarget;
      const t = settled;
      const step = Math.floor(t * SHUFFLE_STEPS);
      const settledChars = Math.floor(t * SENTENCE_CHARS);
      let offset = 0;
      wordEls.forEach((w, i) => {
        w.style.opacity = wordsOn ? "1" : "0";
        const word = WORDS[i];
        const real = w.firstElementChild as HTMLElement | null;
        const scr = w.lastElementChild as HTMLElement | null;
        const start = offset;
        offset += word.length + 1;
        if (!real || !scr) return;
        if (!wordsOn || t >= 1 || reduce) {
          if (real.style.visibility) {
            real.style.visibility = "";
            scr.textContent = "";
            wordKey[i] = "";
          }
          return;
        }
        /* Letters already reached are English; the rest of the word is still Japanese. */
        const done = Math.min(Math.max(settledChars - start, 0), word.length);
        const pending = word.length - done;
        /* As many whole glyphs as fit in the unsettled part of the word, so none is cut at its edge. */
        const room = wordWidth[i] * (pending / word.length);
        // A word not yet reached always shows at least one; a part-settled word shows only what fits.
        const fit = Math.floor(room / glyphWidth[i] + 0.12);
        const count = pending ? (done === 0 ? Math.max(1, fit) : fit) : 0;
        const key = `${done}:${count}:${step}`;
        if (wordKey[i] === key) return; // nothing about this word has changed: write nothing
        wordKey[i] = key;
        real.style.visibility = "hidden";
        let ja = scr.lastElementChild as HTMLElement | null;
        if (!ja) {
          ja = document.createElement("span");
          ja.className = "k-w-ja";
          ja.lang = "ja";
          scr.replaceChildren(document.createTextNode(""), ja);
        }
        scr.firstChild!.textContent = word.slice(0, done);
        let glyphs = "";
        for (let k = 0; k < count; k++) glyphs += glyphAt(i, k, step);
        ja.textContent = glyphs;
      });

      /* Once the sentence has settled, the name's origin is written in, bottom right. */
      const sealTarget =
        reduce || !wordsOn ? 0 : forced !== null ? seg(p, T.words[1], 1) : clamp01((into - settleFrom - settlePx) / sealPx);
      sealed += (sealTarget - sealed) * (forced !== null ? 1 : ease);
      if (Math.abs(sealTarget - sealed) < 0.0005) sealed = sealTarget;
      const seal = sealRef.current;
      if (seal && sealed !== sealDrawn) {
        sealDrawn = sealed;
        seal.style.opacity = String(clamp01(sealed * 10));
        if (pens.length) {
          // One timeline across the three characters, each written in turn.
          const total = pens.reduce((sum, pen) => sum + pen.duration, 0);
          let at = sealed * total;
          for (const pen of pens) {
            pen.update({ time: Math.min(Math.max(at, 0), pen.duration) });
            at -= pen.duration;
          }
        }
      }
    };
    cleanups.push(addScene({ measure: measureLayout, update: loop }));
    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <main id="main" ref={rootRef} className={`kmotion ${garamond.className}`}>
      <ScrollField />
      <div ref={progressRef} className="k-progress" aria-hidden="true" />
      <div className="k-chapter" aria-hidden="true" data-on={chapter ? "" : undefined}>
        {CHAPTERS.map((c, i) => (
          <span key={c.id} data-active={chapter === c.id ? "" : undefined}>
            <b>{String(i + 1).padStart(2, "0")}</b> {c.label}
          </span>
        ))}
      </div>
      <header className="k-header">
        <HeaderLogo />
      </header>
      <a href={`mailto:${CONTACT_EMAIL}`} className="k-top-cta">
        {CONTACT_COPY.cta}
        {/* A short orange line that travels the outline at a constant speed, with a fainter tail. */}
        <svg className="k-top-cta-trace" aria-hidden="true">
          <rect className="k-top-cta-tail" width="100%" height="100%" rx="17.5" pathLength={100} />
          <rect className="k-top-cta-lead" width="100%" height="100%" rx="17.5" pathLength={100} />
        </svg>
      </a>

      <section ref={trackRef} className="k-track" style={reduced ? { height: "100vh" } : undefined}>
        <div ref={stageRef} className="k-stage">
          <div
            ref={heroBoxRef}
            className={`k-hero ${montserrat.className}`}
            role="img"
            aria-label={`kebiki. ${TAGLINE}`}
            data-metal="wait"
          >
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
            <div ref={metalRef} className="k-metal" aria-hidden="true">
              <LiquidLogo active={metalActive} onReady={onMetalReady} />
            </div>
          </div>
          <div ref={hintRef} className="k-label k-hint">scroll ↓</div>

          <div ref={overlayRef} className="k-overlay" aria-hidden="true" />
          {!reduced ? (
            <div className="k-final">
              <p>
                <span className="k-sr">{SENTENCE}</span>
                {WORDS.map((w, i) => (
                  <span key={i} aria-hidden="true" className={i < HEAD_WORDS ? "k-final-head" : undefined}>
                    <span className="k-w" ref={(el) => { wordRefs.current[i] = el; }}>
                      <span className="k-w-real">{w}</span>
                      <span className="k-w-scr" />
                    </span>
                    {i < WORDS.length - 1 ? " " : ""}
                    {i === HEAD_WORDS - 1 ? <span className="k-final-gap" /> : null}
                  </span>
                ))}
              </p>
              <div className="k-seal" lang="ja" ref={sealRef}>
                <span className="k-seal-rule" aria-hidden="true" />
                <span className="k-seal-ja">罫引き</span>
                <span className="k-seal-ink" aria-hidden="true">
                  {SEAL_CHARS.map((c) => (
                    <span key={c} className="k-seal-char" />
                  ))}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {reduced ? (
        <section className="k-static">
          <p>
            {SENTENCE}
          </p>
          <div className="k-seal" lang="ja">
            <span className="k-seal-rule" aria-hidden="true" />
            <span className="k-seal-ja">罫引き</span>
          </div>
        </section>
      ) : null}

      <section id="next" className="k-next" ref={stepsRef}>
        <div className="k-label">{HOW.consult.label}</div>
        <h2 className="k-engage-heading k-next-row" data-lines="">
          <span className="k-head-line">{HOW.consult.heading[0]}</span>
          <span className="k-head-line">{HOW.consult.heading[1]}</span>
        </h2>
        <p className="k-engage-lead k-next-row">{HOW.consult.lead}</p>
        <ul className="k-always k-consult">
          {HOW.consult.points.map((c) => (
            <li key={c.title} className="k-next-row">
              <span className="k-always-title">{c.title}</span>
              <span className="k-always-text">{c.text}</span>
            </li>
          ))}
        </ul>
        <p className="k-engage-cta k-next-row">
          {/* The booking page when one is set; otherwise the same button writes an email. */}
          <a
            href={BOOKING_URL || `mailto:${CONTACT_EMAIL}`}
            className="k-cta k-cta-onink"
            {...(BOOKING_URL ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {HOW.consult.cta}<span aria-hidden="true"> &#8599;</span>
          </a>
        </p>
        <p className="k-engage-cta-note k-next-row">
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("An idea to talk through")}`}>{HOW.consult.ctaNote}<span className="k-engage-cta-arrow" aria-hidden="true"> &rarr;</span></a>
        </p>

        <div className="k-block">
          <div className="k-label k-label-inline">{HOW.routes.label}</div>
          <p className="k-engage-lead k-engage-lead-wide k-next-row">{HOW.routes.lead}</p>
          <ul className="k-routes">
            {HOW.routes.items.map((r) => (
              <li key={r.n} className="k-next-row">
                <span className="k-next-n">{r.n}</span>
                <h3 className="k-route-title">{r.title}</h3>
                <p className="k-route-text">{r.text}</p>
                {r.href ? (
                  <a href={r.href} className="k-route-tag">
                    {r.tag}<span aria-hidden="true"> &darr;</span>
                  </a>
                ) : (
                  <span className="k-route-tag">{r.tag}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="k-block" id="sprint">
          <div className="k-label k-label-inline">{HOW.sprint.label}</div>
          <p className="k-engage-lead k-engage-lead-wide k-next-row">{HOW.sprint.lead}</p>
          <ol className="k-next-list">
            {HOW.sprint.steps.map((it) => (
              <li key={it.n} className="k-next-row">
                <span className="k-next-n">{it.n}</span>
                <h3 className="k-next-verb">{it.verb}</h3>
                <div className="k-next-detail">
                  <p className="k-next-text">{it.text}</p>
                  <p className="k-next-charge">
                    <span className="k-term-key">{it.days} &middot; {it.output}</span>
                    {it.outputText}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="k-engage-outcome k-next-row" data-lines="">
            <span className="k-head-line">{HOW.sprint.outcome[0]}</span>
            <span className="k-head-line">{HOW.sprint.outcome[1]}</span>
          </p>
          <p className="k-engage-own k-next-row">{HOW.sprint.ownership}</p>
        </div>
      </section>

      <section id="terms" className="k-terms">
        <div className="k-label">{TERMS.label}</div>
        <h2 className="k-engage-heading k-next-row" data-lines="">{TERMS.heading}</h2>
        <p className="k-terms-after k-next-row">
          {TERMS.after.text}{" "}
          <Link href="/terms">
            {TERMS.after.link}<span aria-hidden="true"> &rarr;</span>
          </Link>
        </p>
        <div className="k-terms-cta k-next-row">
          <a href={`mailto:${CONTACT_EMAIL}`} className="k-cta k-cta-onink">
            {CONTACT_COPY.cta}<span aria-hidden="true"> &rarr;</span>
          </a>
        </div>
      </section>

      <section id="work" className="k-work">
        <WorkRoller />
        {QUOTES_SHOWN.length > 0 ? (
          <ul className="k-quotes">
            {QUOTES_SHOWN.map((t) => (
              <li key={t.name} className="k-quote k-next-row">
                <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
                <p className="k-quote-who">
                  {t.name}, {t.role}, {t.company}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="k-work-note k-next-row">{WORK_NOTE}</p>
      </section>

      <section id="team" className="k-team">
        <div className="k-label">{TEAM_COPY.label}</div>
        <h2 className="k-team-title k-next-row" data-lines="">{TEAM_COPY.title}</h2>
        <p className="k-team-body k-next-row">{TEAM_COPY.body}</p>
        <TeamRotator />
      </section>

      <section id="contact" ref={contactRef} className="k-contact">
        <div className="k-label k-contact-label">Contact</div>
        <h2 className="k-contact-title k-next-row" data-lines="">{CONTACT_COPY.title}</h2>
        <p className="k-contact-body k-next-row">{CONTACT_COPY.body}</p>
        <div className="k-next-row">
          <ContactActions />
          <ContactEmail />
        </div>
        <dl className="k-contact-lists k-next-row">
          <div>
            <dt>Services</dt>
            <dd>
              <ul className="k-tags">
                {SERVICES.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Sectors</dt>
            <dd>
              <ul className="k-tags">
                {SECTORS.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>

        <footer className="k-footer k-next-row">
          <CityClocks />
          {/* The page ends here, so the ways to get in touch are repeated where the reader stops. */}
          <div className="k-footer-actions">
            <ContactActions />
          </div>
          <div className="k-footer-base">
            <p className="k-footer-note">&copy; {new Date().getFullYear()} Kebiki</p>
            {SOCIAL_LINKS.length ? (
              <ul className="k-social" aria-label="Elsewhere">
                {SOCIAL_LINKS.map((l) => (
                  <li key={l.key}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label}>
                      {l.icon ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d={BRAND_ICONS[l.icon].path} />
                        </svg>
                      ) : (
                        <span className="k-social-text">{l.label}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </footer>
      </section>
    </main>
  );
}
