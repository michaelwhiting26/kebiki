import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import Link from "next/link";

import { CONTACT_EMAIL } from "../contact-config";
import { CREAM_PATH, DOT_PATH, ORANGE_PATH } from "../logo-paths";
import { COMMERCIAL_MODELS } from "../terms-data";
import "../motion.css";

const garamond = EB_Garamond({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "How we charge",
  description:
    "The five commercial models Kebiki works under once Define is done: hourly, fixed price, maximum price, retainer and equity, and who carries the cost risk in each.",
  alternates: { canonical: "/terms" },
};

/** The five commercial models, moved off the home page so the prices there say one thing. */
export default function TermsPage() {
  return (
    <main id="main" className={`kmotion k-page ${garamond.className}`}>
      <header className="k-page-header">
        <Link href="/" aria-label="Kebiki home">
          <svg viewBox="360 290 950 320" className="k-header-logo" aria-hidden="true">
            <path d={CREAM_PATH} className="k-h-cream" />
            <path d={ORANGE_PATH} className="k-h-orange" />
            <path d={DOT_PATH} className="k-h-orange" />
          </svg>
        </Link>
        <Link href="/#terms" className="k-page-back">
          <span aria-hidden="true">&larr; </span>The three prices
        </Link>
      </header>

      <section className="k-terms">
        <div className="k-label">{COMMERCIAL_MODELS.label}</div>
        <h1 className="k-engage-heading">{COMMERCIAL_MODELS.heading}</h1>
        <p className="k-engage-body">{COMMERCIAL_MODELS.body}</p>
        <ul className="k-models">
          {COMMERCIAL_MODELS.models.map((m) => (
            <li key={m.n} className="k-model">
              <span className="k-term-n">{m.n}</span>
              <div className="k-model-title">
                <h2 className="k-model-name">{m.name}</h2>
                <p className="k-model-line">{m.line}</p>
              </div>
              <div className="k-model-main">
                <p className="k-model-text">{m.text}</p>
                <p className="k-model-best">
                  <span className="k-term-key">Best for</span>
                  {m.best}
                </p>
              </div>
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
        <div className="k-terms-cta">
          <a href={`mailto:${CONTACT_EMAIL}`} className="k-cta k-cta-onink">
            Start a conversation<span aria-hidden="true"> &rarr;</span>
          </a>
        </div>
      </section>
    </main>
  );
}
