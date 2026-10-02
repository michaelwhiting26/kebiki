import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeContent: "center",
        padding: "0 8vw",
        background: "#0e0e10",
        color: "#f8f5f0",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <p style={{ margin: 0, fontSize: "clamp(34px, 6vw, 84px)", lineHeight: 1.05 }}>
        That page isn&apos;t here.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 28,
          width: "fit-content",
          color: "#fd540d",
          fontSize: 22,
          textDecoration: "none",
          borderBottom: "2px solid #fd540d",
        }}
      >
        Back to kebiki.studio
      </Link>
    </main>
  );
}
