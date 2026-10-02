import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://kebiki.studio"),
  title: "Kebiki",
  description:
    "Kebiki is a founder-led product strategy, design and engineering studio focused on turning complex ideas into refined digital products.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" style={{ background: "#0e0e10" }}>
      <body style={{ margin: 0, background: "#0e0e10" }}>{children}</body>
    </html>
  );
}
