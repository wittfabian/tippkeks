import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { serverEnv } from "@/lib/env.server";
import { de } from "@/messages/de";

// Absolute base for Open Graph / icon URLs. Link-preview crawlers (Teams, Slack,
// WhatsApp) require absolute og:image URLs, so the relative opengraph-image route
// must resolve against the public origin — same SITE_URL the auth redirects use,
// falling back to localhost in dev (where SITE_URL is intentionally unset).
const siteUrl = serverEnv.SITE_URL ?? "http://localhost:3000";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font for headings, scorelines and ranks — the single "fancy" type lever.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: de.app.name,
    template: `%s · ${de.app.name}`,
  },
  description: de.app.description,
  applicationName: de.app.name,
  // Link-preview cards. The opengraph-image route auto-fills og:image +
  // twitter:image (with dimensions); these set the surrounding copy. Per-page
  // metadata (e.g. the invite page) overrides title/description but inherits the
  // image, so every shared link shows the brand mark.
  openGraph: {
    type: "website",
    siteName: de.app.name,
    locale: "de_DE",
    title: de.app.name,
    description: de.app.description,
  },
  twitter: {
    card: "summary_large_image",
    title: de.app.name,
    description: de.app.description,
  },
  // Full-screen launch + correct title when added to the iOS home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: de.app.name,
  },
  // Next emits the modern `mobile-web-app-capable`; the apple-prefixed legacy
  // tag is added explicitly so iOS < 16.4 also launches full-screen.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfb" },
    { media: "(prefers-color-scheme: dark)", color: "#16201c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
