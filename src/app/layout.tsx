import type { Metadata } from "next";

const description =
  "Kebiki is a founder-led product strategy, design and engineering studio focused on turning complex ideas into refined digital products.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kebiki.studio"),
  title: { default: "Kebiki - complex digital products, built to last", template: "%s | Kebiki" },
  description,
  applicationName: "Kebiki",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://kebiki.studio",
    siteName: "Kebiki",
    title: "Kebiki - complex digital products, built to last",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Kebiki - complex digital products, built to last",
    description,
  },
};

/** Organization schema, so search engines get the identity and contact right. */
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kebiki",
  url: "https://kebiki.studio",
  description,
  email: "hello@kebiki.studio",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" style={{ background: "#0e0e10" }}>
      <body style={{ margin: 0, background: "#0e0e10" }}>
        {children}
        <script
          type="application/ld+json"
          // Static, developer-authored JSON: no user input reaches this.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </body>
    </html>
  );
}
