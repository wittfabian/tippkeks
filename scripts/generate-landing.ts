/**
 * Generates site/ — the public project page published to GitHub Pages, plus the
 * files search engines and LLM crawlers look for next to it:
 *
 *   site/index.html   the page itself (self-contained: inline CSS, inline SVG)
 *   site/og.png       1200×630 social preview, rasterised from the brand mark
 *   site/robots.txt   crawl permission + sitemap pointer
 *   site/sitemap.xml  one entry, but it is what verification tools ask for
 *   site/llms.txt     plain-text summary for LLM crawlers (llmstxt.org)
 *
 * The page makes no external request at all — not for want of a bundler, but
 * because the project promises no third-party tracking, and a webfont or CDN
 * would quietly send every visitor's IP to someone else.
 *
 * All German copy comes from src/messages/de.ts (the single language boundary),
 * exactly like public/offline.html.
 *
 * Run:
 *   pnpm tsx scripts/generate-landing.ts
 *
 * Env (the Pages workflow derives all of these from the repository itself, so
 * you only set them by hand for a local preview — see docs/configuration.md):
 *   PAGE_URL     required — canonical URL the page is served under, with a
 *                trailing slash. No default: guessing it would silently publish
 *                a canonical tag and sitemap pointing at the wrong site.
 *   REPO_URL     required — repository the page links to.
 *   IMPRINT_URL  optional — adds an "Impressum" link to the footer.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { de } from "../src/messages/de";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "site");

/** An unset repository Variable arrives as "", which must read as absent. */
function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    console.error(`${name} is not set. See docs/configuration.md → The project page.`);
    process.exit(1);
  }
  return value;
}

const REPO_URL = requiredEnv("REPO_URL");
// Trailing slash matters: canonical, og:url and the sitemap must agree exactly
// with the URL the host serves, or the signals point at two different pages.
const PAGE_URL = requiredEnv("PAGE_URL").replace(/\/?$/, "/");
const IMPRINT_URL = optionalEnv("IMPRINT_URL");
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
const README_URL = `${REPO_URL}#readme`;
const OG_IMAGE_URL = `${PAGE_URL}og.png`;

const BRAND_DARK = "#16201C";
const BRAND_GOLD = "#E0A458";

const icon = readFileSync(join(root, "src/app/icon.svg"), "utf8");
const buildDate = new Date().toISOString().slice(0, 10);

/** Escape for HTML text and quoted attributes — env values are not our copy. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A link, never an address. The page carries no operator details of its own:
 * whoever publishes it points at wherever their Impressum already lives, so
 * nobody's postal address ends up in this repository or in a fork of it.
 */
function imprintLink(): string {
  if (!IMPRINT_URL) return "";
  return `\n          <a href="${esc(IMPRINT_URL)}">${esc(de.projectPage.footerImprint)}</a>`;
}

/**
 * Structured data. SoftwareSourceCode (not SoftwareApplication) because what is
 * on offer here is the repository, not a service anyone can sign up to; the
 * FAQPage mirrors the visible questions one-to-one, which is what makes it
 * eligible for a rich result instead of a manual action.
 */
function jsonLd(): string {
  const { app, projectPage } = de;

  const graph = [
    {
      "@type": "SoftwareSourceCode",
      "@id": `${PAGE_URL}#project`,
      name: app.name,
      description: projectPage.summary,
      url: PAGE_URL,
      codeRepository: REPO_URL,
      programmingLanguage: ["TypeScript", "SQL"],
      runtimePlatform: "Node.js",
      applicationCategory: "SportsApplication",
      license: "https://spdx.org/licenses/MIT.html",
      inLanguage: "de",
      isAccessibleForFree: true,
      // So an assistant summarising the project states the maintenance status
      // rather than implying an actively developed tool.
      creativeWorkStatus: "Unmaintained",
      image: OG_IMAGE_URL,
      dateModified: buildDate,
    },
    {
      "@type": "WebSite",
      "@id": `${PAGE_URL}#website`,
      url: PAGE_URL,
      name: app.name,
      description: projectPage.description,
      inLanguage: "de",
      about: { "@id": `${PAGE_URL}#project` },
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: projectPage.faq.map((entry) => ({
        "@type": "Question",
        name: entry.q,
        acceptedAnswer: { "@type": "Answer", text: entry.a },
      })),
    },
  ];

  // </script> inside JSON would close the block early; no other escaping applies.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(
    /<\//g,
    "<\\/",
  );
}

function renderPage(): string {
  const { app, landing, projectPage } = de;
  const favicon = `data:image/svg+xml,${encodeURIComponent(icon)}`;
  const pageTitle = `${app.name} – ${projectPage.title}`;

  const features = projectPage.features
    .map(
      (feature) => `
            <article class="card">
              <h3>${esc(feature.title)}</h3>
              <p>${esc(feature.body)}</p>
            </article>`,
    )
    .join("");

  const stack = projectPage.stackItems
    .map((item) => `<li>${esc(item)}</li>`)
    .join("\n            ");
  const steps = projectPage.selfHostSteps
    .map((step) => `<li>${esc(step)}</li>`)
    .join("\n            ");

  const faq = projectPage.faq
    .map(
      (entry) => `
            <div class="qa">
              <h3>${esc(entry.q)}</h3>
              <p>${esc(entry.a)}</p>
            </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(projectPage.description)}" />
    <link rel="canonical" href="${PAGE_URL}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="theme-color" content="${BRAND_DARK}" />
    <meta name="author" content="${esc(app.name)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(app.name)}" />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:url" content="${PAGE_URL}" />
    <meta property="og:title" content="${esc(pageTitle)}" />
    <meta property="og:description" content="${esc(projectPage.description)}" />
    <meta property="og:image" content="${OG_IMAGE_URL}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(pageTitle)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(pageTitle)}" />
    <meta name="twitter:description" content="${esc(projectPage.description)}" />
    <meta name="twitter:image" content="${OG_IMAGE_URL}" />

    <link rel="icon" href="${favicon}" />
    <link rel="alternate" type="text/plain" href="${PAGE_URL}llms.txt" title="llms.txt" />
    <script type="application/ld+json">${jsonLd()}</script>
    <style>
      :root {
        color-scheme: light dark;
        --bg: oklch(0.985 0.006 160);
        --fg: oklch(0.17 0.02 165);
        --card: oklch(1 0 0);
        --muted: oklch(0.48 0.02 165);
        --border: oklch(0.9 0.008 160);
        --primary: oklch(0.58 0.16 150);
        --primary-fg: oklch(0.99 0.01 150);
        --gold: ${BRAND_GOLD.toLowerCase()};
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: oklch(0.16 0.018 165);
          --fg: oklch(0.97 0.005 160);
          --card: oklch(0.215 0.02 165);
          --muted: oklch(0.72 0.015 165);
          --border: oklch(0.99 0.01 160 / 12%);
          --primary: oklch(0.7 0.17 150);
          --primary-fg: oklch(0.16 0.03 160);
        }
      }
      * { box-sizing: border-box; }
      html { -webkit-text-size-adjust: 100%; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        line-height: 1.6;
        font-size: 16px;
      }
      a { color: inherit; }
      a:focus-visible, .btn:focus-visible {
        outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 0.25rem;
      }
      .wrap { max-width: 60rem; margin: 0 auto; padding: 0 1.25rem; }

      header { border-bottom: 1px solid var(--border); }
      header .wrap {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; padding-block: 1rem;
      }
      .brand { display: inline-flex; align-items: center; gap: 0.625rem; text-decoration: none; }
      .brand svg { width: 32px; height: 32px; }
      .brand span { font-size: 1.125rem; font-weight: 800; letter-spacing: -0.02em; }

      .btn {
        display: inline-block; text-decoration: none; font-weight: 600;
        border-radius: 0.625rem; padding: 0.5rem 1rem; font-size: 0.9375rem;
        border: 1px solid var(--border); transition: opacity 0.15s;
      }
      .btn:hover { opacity: 0.85; }
      .btn-primary { background: var(--primary); color: var(--primary-fg); border-color: transparent; }

      .hero { padding-block: 4rem 3rem; }
      .badge {
        display: inline-block; font-size: 0.8125rem; font-weight: 600;
        border: 1px solid var(--border); border-radius: 999px;
        padding: 0.25rem 0.75rem; color: var(--muted);
      }
      h1 {
        font-size: clamp(2rem, 7vw, 3.25rem); line-height: 1.1; letter-spacing: -0.03em;
        font-weight: 800; margin: 1.25rem 0 0;
      }
      h1 .accent { color: var(--gold); display: block; }
      .summary { font-size: 1.125rem; font-weight: 500; max-width: 44rem; margin: 1.5rem 0 0; }
      .lead { color: var(--muted); font-size: 1.0625rem; max-width: 42rem; margin: 0.75rem 0 0; }
      .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.75rem; }

      section { padding-block: 2.5rem; border-top: 1px solid var(--border); }
      h2 { font-size: 1.375rem; letter-spacing: -0.02em; margin: 0 0 1rem; }
      h3 { font-size: 1rem; margin: 0 0 0.5rem; }
      section p { color: var(--muted); margin: 0 0 1rem; max-width: 44rem; }

      /* 20rem keeps the four cards at 2×2 on desktop rather than 3+1. */
      .cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }
      .card {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 0.875rem; padding: 1.25rem;
      }
      .card p { margin: 0; font-size: 0.9375rem; }

      .qa { margin-bottom: 1.5rem; }
      .qa p { margin: 0; font-size: 0.9375rem; }

      /* Gold left rule: reads as a caveat, not as another feature block. */
      .notice {
        margin-top: 2.5rem; padding: 1rem 1.25rem;
        border-left: 3px solid var(--gold); background: var(--card);
        border-radius: 0 0.625rem 0.625rem 0;
      }
      .notice h2 { font-size: 0.9375rem; margin: 0 0 0.375rem; }
      .notice p { margin: 0; font-size: 0.9375rem; color: var(--muted); max-width: 44rem; }

      ul, ol { color: var(--muted); margin: 0 0 1rem; padding-left: 1.25rem; }
      li { margin-bottom: 0.375rem; }
      .hint { font-size: 0.9375rem; }

      footer { border-top: 1px solid var(--border); padding-block: 2rem 3rem; }
      footer a { color: var(--muted); }
      .links { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <header>
      <div class="wrap">
        <a class="brand" href="${PAGE_URL}">
          ${icon.trim()}
          <span>${esc(app.name)}</span>
        </a>
        <a class="btn" href="${REPO_URL}">${esc(projectPage.ctaRepo)}</a>
      </div>
    </header>

    <main>
      <article class="wrap hero">
        <span class="badge">${esc(projectPage.status)}</span>
        <h1>
          ${esc(landing.headlineLead)}
          <span class="accent">${esc(landing.headlineAccent)}</span>
        </h1>
        <p class="summary">${esc(projectPage.summary)}</p>
        <p class="lead">${esc(projectPage.lead)}</p>
        <div class="actions">
          <a class="btn btn-primary" href="${REPO_URL}">${esc(projectPage.ctaRepo)}</a>
          <a class="btn" href="${README_URL}">${esc(projectPage.ctaSelfHost)}</a>
        </div>
        <aside class="notice" aria-labelledby="maintenance-heading">
          <h2 id="maintenance-heading">${esc(projectPage.maintenanceHeading)}</h2>
          <p>${esc(projectPage.maintenance)}</p>
        </aside>
      </article>

      <section id="features" aria-labelledby="features-heading">
        <div class="wrap">
          <h2 id="features-heading">${esc(projectPage.featuresHeading)}</h2>
          <div class="cards">${features}
          </div>
        </div>
      </section>

      <section id="technik" aria-labelledby="stack-heading">
        <div class="wrap">
          <h2 id="stack-heading">${esc(projectPage.stackHeading)}</h2>
          <p>${esc(projectPage.stackLead)}</p>
          <ul>
            ${stack}
          </ul>
        </div>
      </section>

      <section id="selbst-hosten" aria-labelledby="selfhost-heading">
        <div class="wrap">
          <h2 id="selfhost-heading">${esc(projectPage.selfHostHeading)}</h2>
          <p>${esc(projectPage.selfHostLead)}</p>
          <ol>
            ${steps}
          </ol>
          <p class="hint">${esc(projectPage.selfHostHint)}</p>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-heading">
        <div class="wrap">
          <h2 id="faq-heading">${esc(projectPage.faqHeading)}</h2>${faq}
        </div>
      </section>
    </main>

    <footer>
      <div class="wrap">
        <div class="links">
          <a href="${REPO_URL}">${esc(projectPage.ctaRepo)}</a>
          <a href="${LICENSE_URL}">${esc(projectPage.licenseNote)}</a>${imprintLink()}
        </div>
      </div>
    </footer>
  </body>
</html>
`;
}

/**
 * llmstxt.org convention: a markdown digest an LLM crawler can read instead of
 * reverse-engineering the HTML. Same facts as the page, no marketing padding.
 */
function renderLlmsTxt(): string {
  const { app, projectPage } = de;
  const faq = projectPage.faq.map((entry) => `### ${entry.q}\n\n${entry.a}`).join("\n\n");
  const features = projectPage.features
    .map((feature) => `- **${feature.title}**: ${feature.body}`)
    .join("\n");

  return `# ${app.name}

> ${projectPage.summary}

${projectPage.lead}

## ${projectPage.maintenanceHeading}

${projectPage.maintenance}

## Funktionsumfang

${features}

## Technik

${projectPage.stackLead}

${projectPage.stackItems.map((item) => `- ${item}`).join("\n")}

## Häufige Fragen

${faq}

## Links

- [Repository](${REPO_URL})
- [Installationsanleitung (README)](${README_URL})
- [Lizenz (MIT)](${LICENSE_URL})

Stand: ${buildDate}
`;
}

function renderRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${PAGE_URL}sitemap.xml
`;
}

function renderSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PAGE_URL}</loc>
    <lastmod>${buildDate}</lastmod>
  </url>
</urlset>
`;
}

/**
 * Social preview card. Built from shapes and system text rather than a designed
 * asset, so it regenerates anywhere the sync job runs (CI included) without
 * shipping a binary that then drifts from the copy it illustrates.
 */
async function writeOgImage(): Promise<void> {
  const { app, projectPage } = de;
  const cookie = await sharp(Buffer.from(icon), { density: 1024 })
    .resize(200, 200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${BRAND_DARK}" />
  <rect x="0" y="606" width="1200" height="24" fill="${BRAND_GOLD}" />
  <text x="100" y="360" font-family="Helvetica, Arial, sans-serif" font-size="86" font-weight="bold" fill="#F4F6F4">${esc(app.name)}</text>
  <text x="100" y="430" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="${BRAND_GOLD}">${esc(projectPage.title)}</text>
  <text x="100" y="500" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#A8B3AD">${esc(projectPage.ogTagline)}</text>
  <text x="100" y="556" font-family="Helvetica, Arial, sans-serif" font-size="23" fill="#6F7B75">${esc(REPO_URL.replace(/^https?:\/\//, ""))}</text>
</svg>`);

  const png = await sharp(background)
    .composite([{ input: cookie, top: 90, left: 100 }])
    .png()
    .toBuffer();

  writeFileSync(join(outDir, "og.png"), png);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), renderPage());
  writeFileSync(join(outDir, "llms.txt"), renderLlmsTxt());
  writeFileSync(join(outDir, "robots.txt"), renderRobotsTxt());
  writeFileSync(join(outDir, "sitemap.xml"), renderSitemap());
  await writeOgImage();

  console.log(`Project page written to site/ for ${PAGE_URL}`);
  console.log("  index.html, og.png, llms.txt, robots.txt, sitemap.xml");
}

void main();
