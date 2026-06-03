import type { MetadataRoute } from "next";

import { de } from "@/messages/de";

/**
 * Web app manifest — makes TippKeks installable as a PWA ("Zum Startbildschirm
 * hinzufügen") on iOS/Android/Desktop. Next links <link rel="manifest"> from
 * this route automatically. Icons are generated from src/app/icon.svg by
 * scripts/generate-pwa-assets.ts. Brand colours: gold #e0a458, dark #26303a.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: de.app.name,
    short_name: de.pwa.shortName,
    description: de.app.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "de",
    dir: "ltr",
    background_color: "#fbfdfb",
    theme_color: "#e0a458",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
