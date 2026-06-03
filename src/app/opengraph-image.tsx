import { ImageResponse } from "next/og";

import { de } from "@/messages/de";

// Applies to every route under app/ (inherited by /join/[code] etc.), so every
// shared link gets a branded preview card. Next emits og:image + twitter:image
// pointing here, resolved against the root layout's metadataBase.
export const alt = `${de.app.name} – ${de.app.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The brand cookie, mirrored from src/app/icon.svg, embedded as a data URI:
// Satori (next/og) rasterises an <img> but does not render arbitrary inline SVG.
const COOKIE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
  <circle cx="20" cy="20" r="17.5" fill="#E0A458" stroke="#B5762E" stroke-width="2"/>
  <circle cx="25.5" cy="27" r="1.4" fill="#B5762E"/>
  <circle cx="9.5" cy="21.5" r="1.3" fill="#B5762E"/>
  <circle cx="24" cy="8.5" r="1.2" fill="#B5762E"/>
  <polygon points="14.58,9.34 18.14,12.77 15.97,17.21 11.08,16.52 10.23,11.66" fill="#26303A"/>
  <polygon points="26.68,13.70 30.38,15.20 30.10,19.19 26.23,20.15 24.11,16.76" fill="#26303A"/>
  <polygon points="18.77,24.02 21.20,27.63 18.52,31.06 14.43,29.57 14.58,25.22" fill="#26303A"/>
</svg>`;
const cookie = `data:image/svg+xml,${encodeURIComponent(COOKIE_SVG)}`;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        // Brand-dark gradient so the gold cookie pops in chat previews.
        backgroundImage: "linear-gradient(135deg, #16201c 0%, #26303a 100%)",
        color: "#f4f6f4",
      }}
    >
      <img src={cookie} width={280} height={280} alt="" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.03em", color: "#ffffff" }}>
          {de.app.name}
        </div>
        <div style={{ fontSize: 38, fontWeight: 600, color: "#e0a458" }}>{de.app.tagline}</div>
      </div>
    </div>,
    { ...size },
  );
}
