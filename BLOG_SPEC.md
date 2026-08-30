# Web3Evals Blog — Implementation Spec

**Status**: Approved via interview, 2026-08-29
**Scope**: Add a blog section to web3evals.com. Pipeline + design only — no real post content is part of this work (posts will be supplied later as Markdown).

---

## 1. Goals & non-goals

**Goals**
- Author posts as Markdown; publishing = commit + push to `main`.
- Blog matches the existing design language exactly (warm dark `#121110`, cream text, Instrument Serif headlines, Inter body, JetBrains Mono labels).
- Zero client-side JavaScript required to read anything. Strict CSP stays unchanged.
- Each post is shareable (own OG image), subscribable (RSS), and discoverable (sitemap, meta).

**Non-goals (explicitly out of scope)**
- Categories/tags, filter chips, featured blocks, load-more, author profiles, cover images (the ARCMAIL reference was used for *tone*, not feature parity).
- Analytics of any kind. CSP remains `default-src 'self'` with no third-party hosts.
- Comments, search, newsletter integration beyond the existing Netlify waitlist form.
- Migrating existing HTML-written posts (user will hand over Markdown later).
- Table of contents sidebar, reveal animation on blog pages, end-of-post CTA, heading anchor links (all declined).

---

## 2. Architecture decision: Eleventy (11ty)

Static site generator, run by Netlify at deploy time. Rationale: the repo currently has no tooling, but a blog means N pages sharing one shell; hand-copying HTML per post (the user's current approach) has already produced theme drift. Eleventy adds a small `package.json` and one build command, emits plain HTML, and requires no runtime JS — compatible with the existing CSP.

### 2.1 Repo restructure (source/output split)

Everything moves under `src/`; Eleventy writes to `_site/`.

```
.
├── .nvmrc                      # 22
├── netlify.toml                # build = "npm run build", publish = "_site"
├── package.json / package-lock.json
├── eleventy.config.js
├── CLAUDE.md                   # rewritten for the new layout
├── BLOG_SPEC.md                # this file
├── scripts/
│   └── og-image.js             # Satori + resvg generator (called from Eleventy)
└── src/
    ├── _data/
    │   └── site.json           # name, url, description, author, social links
    ├── _includes/
    │   ├── layouts/
    │   │   ├── base.njk        # <html> shell: head/meta, header, footer, CSS/JS links
    │   │   ├── home.njk        # extends base — the existing coming-soon page body
    │   │   ├── blog-index.njk  # extends base — /blog/ list
    │   │   └── post.njk        # extends base — article page
    │   └── partials/
    │       ├── header.njk
    │       └── footer.njk
    ├── index.njk               # front matter: layout: home → /index.html
    ├── 404.njk                 # → /404.html (declined — see §9; included only if requested later)
    ├── blog/
    │   ├── blog.11tydata.json  # layout: post, permalink: /blog/{{ page.fileSlug }}/, tags: post
    │   ├── index.njk           # layout: blog-index, permalink /blog/
    │   └── <slug>.md           # one file per post (or <slug>/index.md when the post has images)
    ├── feed.njk                # → /feed.xml (Atom)
    ├── sitemap.njk             # → /sitemap.xml (generated; replaces hand-written file)
    ├── robots.txt              # passthrough
    ├── _headers                # passthrough (Netlify CSP + caching)
    ├── css/  fonts/  images/  js/   # passthrough copies
```

Static passthrough: `css`, `fonts`, `images`, `js`, `robots.txt`, `_headers`. Post-local images live beside the post (`src/blog/<slug>/*.png`) and are passthrough-copied to `/blog/<slug>/`.

### 2.2 Tooling pins
- Node 22 via `.nvmrc`; Netlify honours it. `netlify.toml`:
  ```toml
  [build]
    command = "npm run build"
    publish = "_site"
  ```
- npm with committed `package-lock.json`.
- Scripts: `build` (`eleventy`), `dev` (`eleventy --serve`; replaces `python3 -m http.server` in CLAUDE.md).
- Prettier: not added (declined).

### 2.3 Dependencies (all devDependencies, all build-time only)
| Package | Purpose |
|---|---|
| `@11ty/eleventy` v3 | SSG |
| `@11ty/eleventy-plugin-rss` | Atom feed helpers |
| `markdown-it` + `markdown-it-footnote` | Markdown, footnotes (tables are built-in) |
| `markdown-it-mathjax3` (or `@mdit/plugin-mathjax` equivalent) | LaTeX → SVG at build (§5.4) |
| `@11ty/eleventy-plugin-syntaxhighlight` (Prism) | Build-time code highlighting; Solidity via `prism-solidity` |
| `satori`, `@resvg/resvg-js` | Per-post OG PNG generation |
| `reading-time` | *not used* — reading time was declined |

No runtime dependencies ship to the browser.

---

## 3. URL structure

| Page | URL | Notes |
|---|---|---|
| Home (unchanged content) | `/` | Existing coming-soon page, rendered from `src/index.njk` |
| Blog index | `/blog/` | Trailing slash; Netlify pretty URLs |
| Post | `/blog/<slug>/` | slug = filename (kebab-case), overridable via frontmatter `permalink` |
| Feed | `/feed.xml` | Atom 1.0 |
| Sitemap | `/sitemap.xml` | Generated, includes home + index + every published post |
| OG image | `/og/<slug>.png` | Generated; `/images/og-2.png` stays for home |

Canonical host remains `https://www.web3evals.com/`.

---

## 4. Content model (frontmatter)

Minimal by decision. Every post:

```yaml
---
title: "Post title"
description: "One sentence used on the index list, <meta description>, OG, and feed summary."
date: 2026-09-01          # ISO date; drives ordering and display
draft: false               # optional; true → excluded from build entirely
# slug is the filename; permalink override is optional
---
```

Rules:
- `title`, `description`, `date` are required; the build fails loudly (thrown error in a computed-data check) if any are missing.
- Sorting: newest first by `date`.
- Visibility: a post is excluded from the index, feed, sitemap, prev/next, OG generation, *and* is not written to `_site` if `draft: true` **or** `date` is in the future relative to build time. (Netlify Deploy Previews on non-main branches build with `ELEVENTY_ENV=preview`, where drafts and future posts **are** rendered so they can be reviewed.)
- `date` renders as e.g. `Sep 1, 2026` (index) and `September 1, 2026` (post header). `<time datetime>` is always emitted.
- No author, category, reading time, or cover image fields.

---

## 5. Markdown pipeline

### 5.1 Base
`markdown-it` with `html: true`, `linkify: true`, `typographer: true` (smart quotes/dashes suit the editorial voice). External links (`http` not on the canonical host) get `rel="noopener"`; no `target=_blank` (reader's choice).

### 5.2 Code blocks — custom warm monochrome Prism theme
Build-time highlighting emits `<pre class="language-x">` with token `<span>`s. No client JS.

- Container: background `--surface`, `1px solid --line`, radius 8px, padding 18px 20px, `overflow-x: auto`, JetBrains Mono 14px / 1.6.
- Optional language label top-right (mono, uppercase, `--faint`) taken from the fence info string.
- Inline `code`: mono 0.9em, `--surface` background, `1px solid --line-soft`, 3px radius.
- Token palette (defined as tokens in `tokens.css`, ~8 colours, derived from cream/muted/faint plus one warm accent):
  - default text `--cream`
  - comment `--faint`, italic
  - punctuation/operator `--muted`
  - keyword `--code-accent` (warm amber-cream, e.g. `#D9B27C`)
  - string `--code-string` (muted warm, e.g. `#C8B79A`)
  - number/constant/boolean `--cream-bright`
  - function/class-name `--cream-bright`
  - type/builtin `--code-accent` at reduced opacity
  Exact hex values are tuned during implementation against Solidity, Rust, JS, and bash samples; must pass 4.5:1 contrast on `--surface`.
- Languages registered: Prism default set + `solidity`, `rust`, `toml`, `bash`, `json`, `diff`.

### 5.3 Images
`![alt](./image.png "optional caption")` → `<figure><img loading="lazy" decoding="async" width height><figcaption>…</figcaption></figure>`. Width/height are read from the file at build (via `@11ty/eleventy-img` in metadata-only mode, or `image-size`) to prevent layout shift. Images are bordered with `1px solid --line-soft`, radius 8px, max-width 100%. Post images live next to the post file.

### 5.4 Math — MathJax SVG at build (CSP-safe)
KaTeX was rejected: its HTML output carries inline `style=""` attributes that `style-src 'self'` blocks. MathJax's SVG output is used instead, configured with `fontCache: 'none'` and the shared `<style>` block **not** emitted inline; the small set of required rules is copied once into `css/blog.css`. Result: each equation is an inline `<svg>` with no style attributes, no external fonts, no CSP changes. `$…$` inline and `$$…$$` display. SVG text colour inherits `currentColor` (cream).

### 5.5 Tables & footnotes
- Tables wrapped at render time in `<div class="table-wrap">` with `overflow-x: auto` so wide tables never cause body scroll. Mono header row (uppercase, `--faint`), `--line-soft` row rules.
- Footnotes via `markdown-it-footnote`: rendered at the end under a hairline rule, mono superscripts, backlinks retained.

### 5.6 Headings
`h2`/`h3` render in Instrument Serif (regular), `--cream-bright`; `h4+` in Inter 600. No auto-anchor links (declined). Heading `id`s are still generated (harmless, allows manual deep links).

---

## 6. Typography additions

Two new self-hosted Latin subsets in `src/fonts/` with `@font-face` in `tokens.css`, `font-display: swap`:
- `inter-latin-600.woff2` → `strong`, `b`, `h4+`
- `inter-latin-400-italic.woff2` → `em`, `i`, `cite`

Existing font caching (`/fonts/*` immutable, 1 year) applies; file names are new so no cache conflict. `instrument-serif-latin-400.woff2` remains preloaded on all pages; Inter 400 is additionally preloaded on post pages (body font is above-the-fold there).

---

## 7. Page designs

All pages share `base.njk`: same `<head>` pattern, grain overlay, header, footer, `tokens → base → site → blog` CSS order (`blog.css` only linked on blog pages; contains index, post, code, table, math, footnote styles). Colours come exclusively from `tokens.css`.

### 7.1 Header (site-wide, single partial)
- Left: existing brand mark + "Web3Evals" (links home).
- Right: `Blog` link — JetBrains Mono, uppercase, letter-spaced, `--muted`, hover `--cream`, same treatment as footer links.
- Active state on `/blog/*`: `aria-current="page"` plus a 4px cream dot before the label (mirrors the badge dot) — no underline.
- Mobile: unchanged single row; the link has ≥44px tap area.
- Home keeps its `.reveal reveal-frame` entrance; blog pages render the header static.

### 7.2 Footer (site-wide)
`© 2026 Web3Evals` left; right: `GitHub · Email · RSS` (RSS → `/feed.xml`). Year still filled by `[data-year]`.

### 7.3 Homepage
Content untouched apart from the header link and footer RSS link. Waitlist form/JS behaviour unchanged. Converted to `index.njk` using the `home` layout; markup output must be byte-equivalent to the current `index.html` body except for those two additions.

### 7.4 Blog index — `/blog/`
Editorial single column, `max-width: 680px`, centred, top padding matching the homepage rhythm.

```
[mono eyebrow]   • WRITING            (badge style, but text-only, no pill border)
[serif h1]       Notes on evaluating LLMs for Web3 security.   (Instrument Serif ~44–56px, clamp)
[sans intro]     one short line, --muted   (from site.json, optional)

─────────────────────────────────────────  (--line-soft)
SEP 01, 2026                                (mono, --faint, 12px, uppercase)
Post title in Instrument Serif ~28px        (link; whole row is the hit area)
One-line description in Inter 16px, --muted
─────────────────────────────────────────
… next entry …
```

- Entries are `<article>` inside an `<ol reversed>`-free plain list (`<ul>` with `role=list`), each a single `<a>` wrapping title only (description not inside the link, for accessibility), with the row made clickable via `::after` overlay pattern.
- Hover: title → `--cream-bright`; row background stays flat (no cards).
- Empty state (zero published posts): eyebrow + heading + a single mono line "First post coming soon." Never render an empty list.
- Year grouping: not in v1 (one flat list); revisit when >15 posts.
- `<title>`: `Blog — Web3Evals`; description from site.json; OG image `/images/og-2.png`.

### 7.5 Post page — `/blog/<slug>/`
- Measure: `max-width: 680px`.
- Header block: mono date (uppercase, `--faint`) → `h1` Instrument Serif regular, `clamp(36px, 6vw, 52px)`, line-height 1.05, `--cream-bright` → description in Inter 18px `--muted` → hairline rule.
- Body: Inter 400, `17.5px` (clamp 17–18), line-height 1.65, `--cream`; paragraphs spaced 1.25em; max line length naturally ~70ch.
- Links: cream with `--line`-coloured underline, underline-offset 3px; hover → solid cream underline.
- Blockquote: left `2px solid --line`, `--muted`, italic Inter.
- `hr`: `--line-soft`.
- Lists: 1.5em indent, marker `--faint`.
- Bottom: hairline, then **prev / next navigation** — two columns on desktop (stack on mobile): mono label `← OLDER` / `NEWER →` (`--faint`) above the neighbouring post's serif title (link, 20px). Only rendered sides that exist. Below that, the footer.
- No reveal animation, no ToC, no CTA, no share buttons.
- `<head>` per post: `<title>{{title}} — Web3Evals</title>`, description, canonical, `og:type=article`, `article:published_time`, `og:image=/og/<slug>.png` (1200×630, `og:image:alt = title`), `twitter:card=summary_large_image`, `<link rel=alternate type=application/atom+xml href=/feed.xml>` (this feed link is on **all** pages).
- JSON-LD: not included (declined with sitemap/JSON-LD option). Sitemap generation **is** included because the hand-written `sitemap.xml` cannot stay accurate once posts exist.

### 7.6 Responsive
- ≤600px: page padding via existing `--page-pad`; h1 scales via clamp; code blocks and tables scroll internally; prev/next stack; header stays one row.
- Body never scrolls horizontally (verified by test in §10).

### 7.7 Motion & a11y
- `prefers-reduced-motion` respected (existing base.css override). Blog pages have no entrance animation anyway.
- Focus styles from `base.css` apply to all new links.
- Landmarks: `<header>`, `<main id="main">`, `<nav aria-label="Post navigation">`, `<footer>`. Skip link added to `base.njk` (`.visually-hidden` until focused) since pages now have real body content.
- Colour contrast: all text ≥ 4.5:1 on `--bg`/`--surface` (existing `--faint #807A72` on `#121110` ≈ 4.6:1 — kept only for ≥12px mono labels).

---

## 8. Generated artefacts

### 8.1 Atom feed — `/feed.xml`
Via `@11ty/eleventy-plugin-rss`. Title "Web3Evals Blog", `<link rel=self>`, absolute URLs, author from `site.json`, entries: title, `published`/`updated` = date, summary = description, content = full rendered HTML with absolute image URLs (plugin's `htmlToAbsoluteUrls`). Includes all published posts (no cap in v1).

### 8.2 Sitemap — `/sitemap.xml`
`/`, `/blog/`, each published post with `lastmod` = date. Replaces the current static file.

### 8.3 OG images — `/og/<slug>.png` (Satori + resvg)
Generated during the Eleventy build (in an `eleventy.after` hook, or per-post via an async shortcode with an on-disk cache keyed on `slug + title + description` so unchanged posts don't re-render).

Layout, 1200×630:
- Background `--bg` (`#121110`) with a soft radial cream glow top-centre (Satori supports `radial-gradient`); no grain (unsupported, acceptable).
- Top-left: brand mark (circle-dot SVG) + "Web3Evals" in Inter 500, cream.
- Centre-left: post title in Instrument Serif 400, ~64px, cream-bright, max 3 lines with ellipsis.
- Bottom-left: mono uppercase `WEB3EVALS.COM · <MON DD, YYYY>` in `--faint`.
- Fonts loaded from the same `src/fonts/*.woff2` files (Satori accepts woff2? — **no**: Satori requires TTF/OTF/WOFF (not woff2). Implementation: add the three needed fonts as `.ttf` under `scripts/fonts/` (build-time only, not shipped to the browser).)
- Output committed? **No** — generated on each Netlify build into `_site/og/`; `_site/` is git-ignored.

---

## 9. Netlify / headers / security

- `_headers` unchanged in policy: CSP remains `default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
  - Verified compatible: Prism output (classes only), MathJax SVG (no style attrs), no inline scripts, no CDNs.
- Add cache rules: `/og/*` `max-age=86400`; `/css/*` and `/js/*` `max-age=3600` (not immutable; filenames aren't hashed).
- Netlify Forms: the waitlist form markup stays in `home.njk` with `data-netlify`, hidden `form-name`, and honeypot intact. Netlify detects forms at build time from HTML in the publish directory — Eleventy output satisfies this. **Post-deploy check required** that the form is still registered.
- 404 page: not included (declined). Netlify's default 404 remains.
- Deploy previews: `ELEVENTY_ENV` set from Netlify's `CONTEXT` (`deploy-preview`/`branch-deploy` → drafts visible; `production` → hidden).

---

## 10. Acceptance criteria

1. `npm ci && npm run build` succeeds on Node 22 with no warnings about missing frontmatter.
2. `/` renders identically to today except the header `Blog` link and footer `RSS` link; waitlist submit still works on Netlify.
3. `/blog/` lists published posts newest-first; a draft or future-dated post is absent from index, feed, sitemap, prev/next, and is not written to `_site` in production; it **is** present in a deploy-preview build.
4. A sample post exercising every feature (h2/h3, bold, italic, links, blockquote, ordered/unordered lists, Solidity + Rust + bash code fences, an image with caption, a wide table, two footnotes, inline and display math) renders correctly with **zero** CSP violations in the browser console. This sample lives at `src/blog/_sample.md` with `draft: true` so it never ships; it is kept in the repo as a regression fixture.
5. `document.documentElement.scrollWidth === window.innerWidth` at 360px, 768px, and 1280px on the index and the sample post.
6. Every post page has canonical, description, `og:image` pointing at an existing 1200×630 PNG, `article:published_time`, and the Atom `<link rel=alternate>`.
7. `/feed.xml` validates (W3C feed validator) and `/sitemap.xml` lists all published URLs.
8. Lighthouse (mobile) on a post page: Performance ≥ 95, Accessibility 100, Best Practices 100, SEO 100.
9. No inline `<style>`, `<script>`, `style=` or `on*=` attributes anywhere in `_site/**/*.html` (grep check in `npm test`).
10. CLAUDE.md rewritten to describe the new structure, `npm run dev`, how to add a post, and the draft/preview rules.

---

## 11. Authoring workflow (for the user)

1. Create `src/blog/my-post-title.md` (or `src/blog/my-post-title/index.md` + images beside it).
2. Fill the four-line frontmatter (§4). Leave `draft: true` while writing if committing early.
3. `npm run dev` → `http://localhost:8080/blog/my-post-title/` to preview.
4. Set `draft: false` (or delete the line), ensure `date` is today or past, push to `main`. Netlify builds and publishes; OG image, feed, sitemap, and prev/next links update automatically.

---

## 12. Open items / risks

- **Satori + woff2**: Satori does not read woff2; TTF copies of Instrument Serif, Inter, JetBrains Mono are needed for build-time only (not served). Confirm licences permit (all three are OFL — fine).
- **MathJax bundle size in build**: `mathjax-full` is large but build-time only; acceptable. If the chosen markdown-it plugin cannot suppress inline styles entirely, fallback is post-processing the HTML to strip `style=` attributes from `mjx-container`/`svg` and moving needed rules into `blog.css`. Must be verified against acceptance criterion 9 before merging.
- **Netlify Forms detection** after switching publish dir to `_site` — verify on first deploy.
- **First-deploy diff is large** (everything moves into `src/`). Do it in one commit titled clearly; the visual result on `/` must be unchanged.
- Future: categories, year grouping, ToC, 404 page, end-of-post CTA, analytics — all intentionally deferred, none blocked by this design.
