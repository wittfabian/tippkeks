import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  AR,
  BE,
  BR,
  CA,
  CH,
  DE,
  ES,
  FR,
  GH,
  HR,
  IT,
  JP,
  KR,
  MA,
  MX,
  NL,
  PT,
  SN,
  US,
  UY,
} from "country-flag-icons/react/1x1";

import { Logo, Wordmark } from "@/components/brand/logo";
import { Countdown } from "@/components/landing/countdown";
import { de } from "@/messages/de";
import { cn } from "@/lib/utils";

/**
 * Country flags as inline SVGs rather than Unicode flag emoji: Windows'
 * Segoe UI Emoji ships no regional-indicator glyphs, so 🇩🇪-style emoji render
 * as bare letters there. The SVG components render identically on every platform.
 */
const FLAGS = {
  AR,
  BE,
  BR,
  CA,
  CH,
  DE,
  ES,
  FR,
  GH,
  HR,
  IT,
  JP,
  KR,
  MA,
  MX,
  NL,
  PT,
  SN,
  US,
  UY,
} as const;

type CountryCode = keyof typeof FLAGS;

function Flag({ code, className }: { code: CountryCode; className?: string }) {
  const FlagSvg = FLAGS[code];
  return <FlagSvg className={cn("rounded-full", className)} aria-hidden />;
}

/**
 * Public marketing landing page at `/`. Forced-dark "stadium at night" hero
 * regardless of the app theme (like the logo, the hero owns its own palette so
 * it always reads as premium). The single job of the page is the login CTA;
 * everything else is atmosphere. All motion is decorative and disabled under
 * prefers-reduced-motion (see globals.css).
 */

/** A glassy, drifting prediction card — the product's core gesture made visual. */
function ScoreChip({
  home,
  away,
  scoreHome,
  scoreAway,
  tag,
  className,
  rotate,
  delay,
}: {
  home: CountryCode;
  away: CountryCode;
  scoreHome: number;
  scoreAway: number;
  tag: string;
  className?: string;
  rotate: string;
  delay: string;
}) {
  return (
    <div className={cn("absolute hidden lg:block", className)} aria-hidden>
      <div style={{ transform: `rotate(${rotate})` }}>
        <div
          data-tk-anim
          className="rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-md"
          style={{ animation: `tk-float 7s ease-in-out ${delay} infinite` }}
        >
          <div className="flex items-center gap-2.5">
            <Flag code={home} className="size-6" />
            <span className="font-heading text-lg font-extrabold text-white tabular-nums">
              {scoreHome}:{scoreAway}
            </span>
            <Flag code={away} className="size-6" />
          </div>
          <div className="mt-1.5 flex justify-center">
            <span className="bg-reward/20 text-reward rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide">
              + {tag}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const MARQUEE_FLAGS = [
  "DE",
  "BR",
  "FR",
  "AR",
  "ES",
  "NL",
  "PT",
  "BE",
  "HR",
  "IT",
  "MX",
  "US",
  "CA",
  "JP",
  "KR",
  "SN",
  "MA",
  "UY",
  "CH",
  "GH",
] as const satisfies readonly CountryCode[];

function FlagMarquee() {
  return (
    <div
      className="relative w-full overflow-hidden py-6"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
      }}
      aria-hidden
    >
      <div
        data-tk-anim
        className="flex w-max gap-4"
        style={{ animation: "tk-marquee 45s linear infinite" }}
      >
        {[...MARQUEE_FLAGS, ...MARQUEE_FLAGS].map((code, i) => (
          <span
            key={i}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04]"
          >
            <Flag code={code} className="size-7" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-heading text-base font-bold text-white">{value}</span>
      <span className="text-white/45">{label}</span>
    </span>
  );
}

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#06120c] text-white">
      {/* Atmosphere: layered floodlight glows + a faint pitch at the foot. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, oklch(0.32 0.07 155) 0%, transparent 55%), linear-gradient(180deg, #06120c 0%, #08190f 50%, #050f0a 100%)",
          }}
        />
        <div
          data-tk-anim
          className="absolute -top-32 -left-24 size-[34rem] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, oklch(0.7 0.17 150 / 0.4), transparent 65%)",
            animation: "tk-glow 9s ease-in-out infinite",
          }}
        />
        <div
          data-tk-anim
          className="absolute top-1/4 -right-24 size-[30rem] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, oklch(0.82 0.14 85 / 0.22), transparent 65%)",
            animation: "tk-glow 11s ease-in-out 1s infinite",
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-1/2 w-[120%] -translate-x-1/2"
          style={{
            background:
              "repeating-linear-gradient(90deg, oklch(0.55 0.13 150 / 0.07) 0 46px, transparent 46px 92px)",
            maskImage: "linear-gradient(to top, black, transparent 75%)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent 75%)",
          }}
        />
      </div>

      {/* Drifting prediction cards. */}
      <ScoreChip
        home="DE"
        away="FR"
        scoreHome={2}
        scoreAway={1}
        tag={de.landing.scoreTags.exact}
        className="top-[24%] left-[7%]"
        rotate="-7deg"
        delay="0s"
      />
      <ScoreChip
        home="BR"
        away="ES"
        scoreHome={3}
        scoreAway={2}
        tag={de.landing.scoreTags.tendency}
        className="top-[30%] right-[8%]"
        rotate="6deg"
        delay="1.4s"
      />
      <ScoreChip
        home="AR"
        away="NL"
        scoreHome={1}
        scoreAway={1}
        tag={de.landing.scoreTags.exact}
        className="bottom-[20%] left-[12%]"
        rotate="5deg"
        delay="0.7s"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Wordmark size={28} />
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          {de.auth.signIn}
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <span className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/75 duration-700">
          <span className="bg-primary relative flex size-2">
            <span
              data-tk-anim
              className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75"
            />
            <span className="bg-primary relative inline-flex size-2 rounded-full" />
          </span>
          {de.landing.eyebrow}
        </span>

        <div className="animate-in fade-in zoom-in-95 fill-mode-both relative mt-9 delay-100 duration-700">
          <div
            data-tk-anim
            className="absolute inset-0 -z-10 blur-2xl"
            style={{
              background: "radial-gradient(circle, oklch(0.7 0.17 150 / 0.45), transparent 70%)",
              animation: "tk-glow 6s ease-in-out infinite",
            }}
            aria-hidden
          />
          <Logo size={104} />
        </div>

        <h1 className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both font-heading mt-7 max-w-3xl text-5xl font-extrabold tracking-tight delay-150 duration-700 sm:text-6xl md:text-7xl">
          <span className="block">{de.landing.headlineLead}</span>
          <span
            className="block bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(100deg, oklch(0.88 0.13 90), oklch(0.78 0.16 70))",
            }}
          >
            {de.landing.headlineAccent}
          </span>
        </h1>

        <p className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both mt-6 max-w-xl text-base text-pretty text-white/60 delay-200 duration-700 sm:text-lg">
          {de.landing.subline}
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both mt-10 delay-300 duration-700">
          <Countdown />
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both mt-10 flex flex-col items-center gap-3 delay-500 duration-700 sm:flex-row">
          <Link
            href="/login"
            className="group bg-primary inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-[#06140d] shadow-[0_12px_45px_-10px_oklch(0.7_0.17_150)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#06120c] focus-visible:outline-none"
          >
            {de.landing.ctaPrimary}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center rounded-full border border-white/20 px-6 py-3.5 text-base font-medium text-white/90 transition hover:border-white/40 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
          >
            {de.landing.ctaSecondary}
          </Link>
        </div>

        <div className="animate-in fade-in fill-mode-both mt-9 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm delay-700 duration-700">
          <Stat value="48" label={de.landing.stats.teamsLabel} />
          <span className="text-white/20">·</span>
          <Stat value="104" label={de.landing.stats.matchesLabel} />
          <span className="text-white/20">·</span>
          <Stat value="1" label={de.landing.stats.winnerLabel} />
        </div>
      </main>

      <FlagMarquee />

      <footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5 pb-6 text-xs text-white/40">
        <Link href="/info" className="transition hover:text-white/70">
          {de.legal.footerNav.info}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="transition hover:text-white/70">
          {de.legal.footerNav.privacy}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/imprint" className="transition hover:text-white/70">
          {de.legal.footerNav.impressum}
        </Link>
        <span aria-hidden>·</span>
        <span>{de.common.poweredBy}</span>
      </footer>
    </div>
  );
}
