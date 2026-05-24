import { ImageResponse } from "next/og";

/**
 * Programmatic favicon. Placeholder per Plan 5 — a brand-orange "L" on a
 * cream square with the brand-soft inner ring. The user will replace this
 * with their generated Lenny's Framework Copilot logo after Plan 5 ships.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FFF7ED",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "1px solid #FED7AA",
        }}
      >
        <div
          style={{
            color: "#F97316",
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          L
        </div>
      </div>
    ),
    { ...size },
  );
}
