"use client";

import { EB_Garamond, Montserrat } from "next/font/google";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CREAM_PATH, DOT_PATH, ORANGE_PATH } from "./logo-paths";
import { BRAND_ICONS, type BrandIcon } from "./brand-icons";
import { BOOKING_URL, SOCIAL_LINKS, WHATSAPP_URL } from "./contact-config";
import { COUNTRY_SHAPES } from "./country-paths";
import { InteractiveDotMap } from "./dot-map";
import { addTick, setLenis } from "./clock";
import { ScrollField } from "./scroll-field";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
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
/** Share of the scroll track the animation plays over; the rest holds the finished sentence. */
const HOLD = 0.9;
/** On load the logo builds by itself up to the finished mark; scrolling then plays the rest. */
const INTRO = { end: T.dotPop[1], delay: 300, ms: 2500 };

/** Box-drawing characters and plus signs that move through the tagline before it resolves. */
const SCRAMBLE_GLYPHS = "+─│┼┬┴├┤╴╵╶╷".split("");
const SVG_NS = "http://www.w3.org/2000/svg";

/** The four capabilities, in the studio's own words (from the main site). */
const CAPABILITIES = [
  { n: "01", verb: "Define", text: "Work out what the business is trying to achieve, who it is for, what limits it and how success gets measured." },
  { n: "02", verb: "Design", text: "Shape the interface, the way information is organised and the system underneath it together - not as separate jobs passed between teams." },
  { n: "03", verb: "Build", text: "Ship in working pieces, each one tested and monitored from the day it goes live." },
  { n: "04", verb: "Evolve", text: "Keep improving the product against what real use shows and what the business needs next." },
] as const;
const CONTACT_EMAIL = "hello@kebiki.studio";

/** How an engagement starts, in the studio's own words (from the main site). */
const ENGAGEMENT = {
  eyebrow: "How an engagement starts",
  heading: "Fourteen days. Four fixed outputs.",
  body: "Enough clarity to decide what happens next - and nothing you cannot walk away from.",
  steps: [
    { days: "Day 01 - 02", span: 2, title: "The problem, restated", text: "A precise definition of what the business is trying to achieve, written in language everyone involved can agree on." },
    { days: "Day 03 - 05", span: 3, title: "The constraint map", text: "We map what we know, what we are assuming and what still needs an answer - with every assumption written down." },
    { days: "Day 06 - 09", span: 4, title: "A working first version", text: "One important part of the product, built end to end and deployed. Real enough to expose the technical, product and operational problems before you commit to building everything." },
    { days: "Day 10 - 14", span: 5, title: "The decision", text: "A written recommendation showing the trade-offs, risks and next steps - with a plan another capable team could execute without us." },
  ],
  outcome: "You leave with a decision. Not another deck.",
  ownership: "Every output is yours, whether we continue together or not. No lock-in. No dependency. No obligation.",
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

/** Each capability paired, in order, with the engagement output it produces. */
const PROCESS = CAPABILITIES.map((c, i) => ({
  n: c.n,
  verb: c.verb,
  text: c.text,
  days: ENGAGEMENT.steps[i].days,
  output: ENGAGEMENT.steps[i].title,
  outputText: ENGAGEMENT.steps[i].text,
}));

/** The people you meet. Surnames show only once all three are filled in, so nobody stands out. */
const TEAM = [
  {
    name: "Michael",
    image: "/team/michael.jpg",
    cover: 77,
    surname: "Whiting",
    linkedin: "",
    role: "Engineering and delivery",
    bio: "Michael scopes, prices and runs every project, and codes alongside the team. International arbitration taught him to build plans that hold up under scrutiny.",
    talk: "scope, pricing, contracts and delivery risk",
  },
  {
    name: "Marc",
    image: "/team/marc.jpg",
    cover: 84,
    surname: "",
    linkedin: "",
    role: "Full-stack engineering",
    bio: "Self-taught, Marc has been writing code since the age of ten and builds across the whole product, from the interface to the database and deployment. Marc owns how the system fits together, so what launches is something the team can keep running.",
    talk: "architecture, data and running in production",
  },
  {
    name: "Riki",
    image: "/team/riki.jpg",
    cover: 80,
    surname: "",
    linkedin: "",
    role: "Engineering and growth",
    bio: "Self-taught, Riki has been writing code since the age of ten and works on both sides of a launch: building the product and putting it in front of the right people.",
    talk: "build, launch and growth",
  },
] as const;
const SHOW_SURNAMES = TEAM.every((m) => m.surname.trim() !== "");
const fullName = (m: (typeof TEAM)[number]) => (SHOW_SURNAMES ? `${m.name} ${m.surname}` : m.name);
/** The fade to the page's black starts just above each portrait's collarbone. */
const coverStyle = (m: { cover: number }) => ({ ["--cover" as string]: `${m.cover}%` }) as React.CSSProperties;

const TEAM_COPY = {
  label: "The studio",
  title: "The people you meet are the people who build.",
  body: "The same team stays with the work from the first idea through to the finished product, so you are always talking to the people making the decisions.",
} as const;

/**
 * Commercial models. `risk` is who carries the risk of the work costing more than expected:
 * 0 = the client, 1 = the studio. Wording is a draft of commercial terms: no prices, no percentages.
 */
const TERMS = {
  label: "How we charge",
  heading: "Five ways to work with us.",
  body: "Most engagements start with the fourteen days above. After that we agree the model that fits the work, and put it in writing before anything starts.",
  models: [
    {
      n: "01",
      name: "Hourly consultation",
      line: "Advice by the hour.",
      text: "A senior second opinion: an architecture review, a technical due-diligence call, a rescue plan. You pay for the time used and can stop at any point.",
      best: "Specific questions, reviews and short pieces of advice.",
      risk: 0.08,
    },
    {
      n: "02",
      name: "Fixed price",
      line: "A defined scope for a set fee.",
      text: "We agree exactly what will be delivered and what it costs. If it takes us longer than we planned, that is our problem, not yours.",
      best: "Work that can be specified clearly up front.",
      risk: 0.92,
    },
    {
      n: "03",
      name: "Maximum price",
      line: "Pay for time used, up to a ceiling.",
      text: "You are billed for the time the work actually takes, with a cap agreed in advance. If it comes in under, you pay less. It cannot go over without your written agreement.",
      best: "Work with real unknowns, where a fixed price would mean padding.",
      risk: 0.62,
    },
    {
      n: "04",
      name: "Retainer",
      line: "Reserved capacity each month.",
      text: "A set amount of the team's time every month for a product that keeps moving: new features, improvements and support. The priorities are yours to change.",
      best: "Live products that need continuous work.",
      risk: 0.28,
    },
    {
      n: "05",
      name: "Equity",
      line: "Part fee, part stake.",
      text: "For a small number of early ventures we take part of our fee as equity, so we carry some of the risk and share in the result. We do this selectively.",
      best: "Early-stage products we believe in.",
      risk: 0.76,
    },
  ],
  always: [
    { title: "Agreed in writing first", text: "Scope, price and model are set down before work starts." },
    { title: "Changes priced before they are made", text: "Nothing is added to the bill without your agreement." },
    { title: "You own the work", text: "Every output is yours, whether we continue together or not." },
  ],
} as const;

const SERVICES = [
  "Product strategy",
  "Brand identity",
  "Product design",
  "Web & app development",
  "AI & automation",
  "Blockchain & payments",
  "Design systems",
] as const;
const SECTORS = ["Fintech & payments", "Crypto & Web3", "Sport & media", "Property", "Enterprise software"] as const;
const CONTACT_COPY = {
  title: "Bring us the hard part.",
  body: "Fourteen days from now, you'll know what to build, what it will take and whether it's worth doing. Every message is answered by the people who would build it, within two working days.",
} as const;

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

const CITIES = [
  { name: "London", zone: "Europe/London", country: "uk" },
  { name: "Dubai", zone: "Asia/Dubai", country: "uae" },
  { name: "Tokyo", zone: "Asia/Tokyo", country: "japan" },
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
            <div className="k-city-shape">
              <InteractiveDotMap d={shape.d} w={shape.w} h={shape.h} label={`Map of ${shape.name}`} />
            </div>
            <span className="k-city-name">{c.name}</span>
            <span className="k-city-time" suppressHydrationWarning>
              {now
                ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: c.zone }).format(now)
                : "\u00a0"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Ways to talk now: a booked call and WhatsApp. Each button exists only if its channel is configured. */
function ContactActions() {
  if (!BOOKING_URL && !WHATSAPP_URL) return null;
  return (
    <div className="k-contact-actions">
      {BOOKING_URL ? (
        <a href={BOOKING_URL} className="k-cta k-cta-solid" target="_blank" rel="noopener noreferrer">
          Book a call<span aria-hidden="true"> &rarr;</span>
        </a>
      ) : null}
      {WHATSAPP_URL ? (
        <a href={WHATSAPP_URL} className="k-cta" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" className="k-cta-icon" aria-hidden="true">
            <path d={BRAND_ICONS.whatsapp.path} />
          </svg>
          WhatsApp us
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
const SHUFFLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=/<>";
const SHUFFLE_MS = 1100;
/** Characters in the sentence after the logo word, which the shuffle settles across. */
const SENTENCE_CHARS = WORDS.slice(1).join(" ").length;

/** Section markers: shown bottom left while each section is on screen. */
const CHAPTERS = [
  { id: "next", label: "What we do" },
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

  /* A thin bar along the top shows how far through the page the visitor is. */
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  const stepsRef = useRef<HTMLElement>(null);

  /* The 14-day steps: the row nearest the middle of the screen lights up. */
  useEffect(() => {
    const section = stepsRef.current;
    if (!section) return;
    const rows = [...section.querySelectorAll<HTMLElement>(".k-next-list > li")];
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let active = -1;
      let best = Infinity;
      rows.forEach((r, i) => {
        const b = r.getBoundingClientRect();
        // Only a row that is actually crossing the middle band counts.
        if (b.top > mid + window.innerHeight * 0.2 || b.bottom < mid - window.innerHeight * 0.2) return;
        const d = Math.abs((b.top + b.bottom) / 2 - mid);
        if (d < best) {
          best = d;
          active = i;
        }
      });
      rows.forEach((r, i) => r.toggleAttribute("data-active", i === active));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
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
    // Scroll fraction of the track, and the point that scroll position zero stands for: it rises
    // with the opening autoplay, then rests on the finished logo.
    let scrollS = 0;
    let base = 0;
    let introDone = reduce || forced !== null;
    const introStart = performance.now();
    let trackBottom = Infinity;
    let overContact = false;
    const readContact = () => {
      const c = contactRef.current?.getBoundingClientRect();
      overContact = !!c && c.top < 40 && c.bottom > 40;
    };
    const readScroll = () => {
      readContact();
      if (reduce || forced !== null) return;
      const r = track.getBoundingClientRect();
      trackBottom = r.bottom;
      scrollS = clamp01(-r.top / (r.height - window.innerHeight) / HOLD);
    };
    const onResize = () => {
      measure();
      readScroll();
    };
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", onResize);
    readScroll();
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

    const wordEls = wordRefs.current.filter((w): w is HTMLSpanElement => !!w);
    let shuffleStart: number | null = null;

    const loop = () => {
      const autoplaying = !introDone;
      if (autoplaying) {
        const t = clamp01((performance.now() - introStart - INTRO.delay) / INTRO.ms);
        base = INTRO.end * (1 - Math.pow(1 - t, 2.2));
        if (t >= 1) introDone = true;
        else if (scrollS > 0.0005) {
          // The visitor scrolled first: the smoothing below carries the logo on to finished
          // and straight into the scroll, from wherever the build had reached.
          base = INTRO.end;
          introDone = true;
        }
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

      // The header logo is ink on the orange screen, and cream again once the page goes dark.
      root.classList.toggle("k-orange", (!reduce && p > T.orangeHeader && trackBottom > 72) || overContact);
      root.classList.toggle("k-past", trackBottom < 72);

      /*
       * The sentence: the same text shuffle as the original studio page. When the orange screen is
       * reached, every word after the logo appears scrambled at once and settles left to right across
       * the whole line in SHUFFLE_MS; it replays each time the visitor scrolls back above it. The
       * scramble is drawn in a clipped layer over the hidden real word, so lines never reflow.
       */
      const now = performance.now();
      const wordsOn = p >= T.words[0];
      if (wordsOn && shuffleStart === null) shuffleStart = now;
      if (!wordsOn && p < T.words[0] - 0.01) shuffleStart = null;
      const t = shuffleStart === null ? 0 : Math.min((now - shuffleStart) / SHUFFLE_MS, 1);
      const settledChars = Math.floor(t * SENTENCE_CHARS);
      let offset = 0;
      wordEls.forEach((w, i) => {
        w.style.opacity = wordsOn ? "1" : "0";
        w.style.transform = "";
        if (i === 0) return;
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
          }
          return;
        }
        real.style.visibility = "hidden";
        scr.textContent = [...word]
          .map((ch, k) => (start + k < settledChars || !/[a-z0-9]/i.test(ch) ? ch : SHUFFLE_GLYPHS[Math.floor(Math.random() * SHUFFLE_GLYPHS.length)]))
          .join("");
      });

      /* Once the sentence has landed, the name's origin settles in, bottom right. */
      const seal = sealRef.current;
      if (seal) {
        const k = quadInOut(seg(p, T.words[1] - 0.01, T.words[1] + 0.03));
        seal.style.opacity = String(k);
        seal.style.transform = `translateY(${(1 - k) * 12}px)`;
      }

    };
    const stopLoop = addTick(loop);

    cleanups.push(() => {
      stopLoop();
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", onResize);
    });
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
                    <span className="k-w" ref={(el) => { wordRefs.current[i] = el; }}>
                      {i === 0 ? (
                        <InlineLogo />
                      ) : (
                        <>
                          <span className="k-w-real">{w}</span>
                          <span className="k-w-scr" />
                        </>
                      )}
                    </span>
                    {i < WORDS.length - 1 ? " " : ""}
                  </span>
                ))}
              </p>
              <div className="k-seal" lang="ja" ref={sealRef}>
                <span className="k-seal-rule" aria-hidden="true" />
                <span className="k-seal-ja">罫引き</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {reduced ? (
        <section className="k-static">
          <p>
            <InlineLogo /> {WORDS.slice(1).join(" ")}
          </p>
          <div className="k-seal" lang="ja">
            <span className="k-seal-rule" aria-hidden="true" />
            <span className="k-seal-ja">罫引き</span>
          </div>
        </section>
      ) : null}

      <section id="next" className="k-next" ref={stepsRef}>
        <div className="k-label">What we do</div>
        <h2 className="k-engage-heading k-next-row">{ENGAGEMENT.heading}</h2>
        <p className="k-engage-body k-next-row">{ENGAGEMENT.body}</p>
        <div className="k-timeline k-next-row" aria-hidden="true">
          {ENGAGEMENT.steps.map((st, i) => (
            <div key={st.days} className="k-tl-seg" style={{ flexGrow: st.span }}>
              <span className="k-tl-n">{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
        <ol className="k-next-list">
          {PROCESS.map((it) => (
            <li key={it.n} className="k-next-row">
              <span className="k-next-n">{it.n}</span>
              <h3 className="k-next-verb">{it.verb}</h3>
              <div className="k-next-detail">
                <p className="k-next-text">{it.text}</p>
                <div className="k-row-out">
                  <span className="k-engage-days">{it.days}</span>
                  <span className="k-row-out-title">{it.output}</span>
                  <span className="k-row-out-text">{it.outputText}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="k-engage-outcome k-next-row">{ENGAGEMENT.outcome}</p>
        <p className="k-engage-own k-next-row">{ENGAGEMENT.ownership}</p>
      </section>

      <section id="terms" className="k-terms">
        <div className="k-label">{TERMS.label}</div>
        <h2 className="k-engage-heading k-next-row">{TERMS.heading}</h2>
        <p className="k-engage-body k-next-row">{TERMS.body}</p>
        <ul className="k-terms-grid">
          {TERMS.models.map((m) => (
            <li key={m.n} className="k-term k-next-row">
              <span className="k-term-n">{m.n}</span>
              <h3 className="k-term-name">{m.name}</h3>
              <p className="k-term-line">{m.line}</p>
              <p className="k-term-text">{m.text}</p>
              <p className="k-term-best">
                <span className="k-term-key">Best for</span>
                {m.best}
              </p>
              <div className="k-risk" role="img" aria-label={`Cost risk: ${m.risk < 0.4 ? "mostly yours" : m.risk > 0.7 ? "mostly ours" : "shared"}`}>
                <span className="k-term-key">Who carries the cost risk</span>
                <div className="k-risk-track">
                  <span className="k-risk-dot" style={{ left: `${m.risk * 100}%` }} />
                </div>
                <div className="k-risk-ends">
                  <span>You</span>
                  <span>Us</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <ul className="k-always">
          {TERMS.always.map((a) => (
            <li key={a.title} className="k-next-row">
              <span className="k-always-title">{a.title}</span>
              <span className="k-always-text">{a.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="work" className="k-work">
        <div className="k-label">Selected work</div>
        <ol className="k-work-list">
          {WORK.map((w) => (
            <li key={w.name} className="k-work-item k-next-row">
              <div className="k-work-meta">
                <span className="k-work-n">{w.n}</span>
                <span className="k-work-cat">{w.category}</span>
              </div>
              <div className="k-work-main">
                <h2 className="k-work-name">{w.name}</h2>
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
              </div>
            </li>
          ))}
        </ol>
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
        <h2 className="k-team-title k-next-row">{TEAM_COPY.title}</h2>
        <p className="k-team-body k-next-row">{TEAM_COPY.body}</p>
        <TeamRotator />
      </section>

      <section id="contact" ref={contactRef} className="k-contact">
        <div className="k-label k-contact-label">Contact</div>
        <h2 className="k-contact-title k-next-row">{CONTACT_COPY.title}</h2>
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
