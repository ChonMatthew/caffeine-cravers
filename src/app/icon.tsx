import { ImageResponse } from "next/og";

// Generated favicon — the placeholder cash-register mark on the app's espresso
// ground, matching the in-app brand glyph. Swap for a real logo later.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "#17110e",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              width: 13,
              height: 6,
              background: "#37a88c",
              borderRadius: 2,
              marginRight: 7,
              marginBottom: 2,
            }}
          />
          <div style={{ width: 22, height: 11, background: "#37a88c", borderRadius: 2 }} />
        </div>
      </div>
    ),
    size,
  );
}
