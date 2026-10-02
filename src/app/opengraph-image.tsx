import { ImageResponse } from "next/og";

import { CREAM_PATH, DOT_PATH, ORANGE_PATH } from "./logo-paths";

export const alt = "Kebiki - complex digital products, built to last";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The logo, centred on the brand's near-black, for link previews. */
export default function OpengraphImage() {
  // The artwork is 950 units wide in its cropped frame; scale it to ~860px.
  const w = 860;
  const h = Math.round((w * 304) / 934);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e0e10",
        }}
      >
        <svg width={w} height={h} viewBox="366 298 934 304" xmlns="http://www.w3.org/2000/svg">
          <path d={CREAM_PATH} fill="#f8f5f0" />
          <path d={ORANGE_PATH} fill="#fd540d" />
          <path d={DOT_PATH} fill="#fd540d" />
        </svg>
        <div
          style={{
            marginTop: 46,
            fontSize: 30,
            letterSpacing: 9,
            color: "#f8f5f0",
          }}
        >
          complex digital products, built to last.
        </div>
      </div>
    ),
    size,
  );
}
