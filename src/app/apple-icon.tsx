import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the orange dot from the logo, on ink. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e10" }}>
        <div style={{ width: 118, height: 118, borderRadius: 59, background: "#fd540d" }} />
      </div>
    ),
    size,
  );
}
