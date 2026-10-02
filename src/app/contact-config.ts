/**
 * Contact channels. Each one is switched on by setting its value (in the Vercel project's
 * environment, or in .env.local for development); an empty value hides its button entirely,
 * so the site can never show a button that leads nowhere.
 *
 *   NEXT_PUBLIC_BOOKING_URL      full https link to the booking page, e.g. https://cal.com/<name>/<event>
 *   NEXT_PUBLIC_WHATSAPP_NUMBER  the WhatsApp number in international form, e.g. +44 7700 900123
 */
const rawBooking = (process.env.NEXT_PUBLIC_BOOKING_URL ?? "").trim();
/** Only an https link is accepted; anything else is treated as not set. */
export const BOOKING_URL = /^https:\/\/[^\s]+$/.test(rawBooking) ? rawBooking : "";

/** Digits only, as wa.me expects (no plus, spaces or dashes). Too short to be a real number counts as not set. */
const waDigits = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
export const WHATSAPP_NUMBER = waDigits.length >= 8 ? waDigits : "";

const WHATSAPP_GREETING = "Hello Kebiki - I'd like to talk about a project.";
export const WHATSAPP_URL = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_GREETING)}`
  : "";

/** Only an https link is accepted; anything else is treated as not set. */
const httpsOrEmpty = (v: string | undefined) => {
  const s = (v ?? "").trim();
  return /^https:\/\/[^\s]+$/.test(s) ? s : "";
};

/**
 * Profile links for the footer. Set any of these to show its link:
 *   NEXT_PUBLIC_LINKEDIN_URL, NEXT_PUBLIC_GITHUB_URL, NEXT_PUBLIC_X_URL,
 *   NEXT_PUBLIC_INSTAGRAM_URL, NEXT_PUBLIC_YOUTUBE_URL, NEXT_PUBLIC_TIKTOK_URL
 */
export const SOCIAL_LINKS = [
  { key: "linkedin", label: "LinkedIn", href: httpsOrEmpty(process.env.NEXT_PUBLIC_LINKEDIN_URL), icon: null },
  { key: "github", label: "GitHub", href: httpsOrEmpty(process.env.NEXT_PUBLIC_GITHUB_URL), icon: "github" },
  { key: "x", label: "X", href: httpsOrEmpty(process.env.NEXT_PUBLIC_X_URL), icon: "x" },
  { key: "instagram", label: "Instagram", href: httpsOrEmpty(process.env.NEXT_PUBLIC_INSTAGRAM_URL), icon: "instagram" },
  { key: "youtube", label: "YouTube", href: httpsOrEmpty(process.env.NEXT_PUBLIC_YOUTUBE_URL), icon: "youtube" },
  { key: "tiktok", label: "TikTok", href: httpsOrEmpty(process.env.NEXT_PUBLIC_TIKTOK_URL), icon: "tiktok" },
  { key: "whatsapp", label: "WhatsApp", href: WHATSAPP_URL, icon: "whatsapp" },
].filter((l) => l.href) as { key: string; label: string; href: string; icon: "github" | "x" | "instagram" | "youtube" | "tiktok" | "whatsapp" | null }[];
