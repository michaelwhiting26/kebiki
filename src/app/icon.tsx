import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** The "K" monogram in the brand persimmon. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ed8725",
          color: "#0e0e10",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 7,
        }}
      >
        K
      </div>
    ),
    size,
  );
}
