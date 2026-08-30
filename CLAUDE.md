# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

web3evals.com: the "coming soon" landing page (with a Netlify Forms waitlist) plus a Markdown blog at `/blog/`. Built with Eleventy 3 into `_site/`; deployed by Netlify on push to `main` (`netlify.toml`: `npm run build`, publish `_site`). Node 22 (`.nvmrc`). No runtime JS beyond `js/main.js`; no client-side framework.

## Commands

```
npm ci            # install (lockfile is committed)
npm run dev       # eleventy --serve → http://localhost:8080 (drafts + future posts visible)
npm run build     # production build → _site/ (drafts + future posts excluded)
npm test          # static checks on _site/: no inline style/script/on*, post meta, feed/sitemap
```

`ELEVENTY_ENV=preview npm run build` reproduces a Netlify Deploy Preview build locally (drafts rendered). `ELEVENTY_ENV=production` forces the production rules even under `--serve`.

The waitlist form only works on Netlify (it POSTs to `/` and relies on Netlify Forms + `data-netlify`). Locally the fetch fails and the JS error branch renders.

## Layout

```
eleventy.config.js        input src/ → output _site/; markdown pipeline, collections, filters, OG shortcode
netlify.toml              build command, publish dir, ELEVENTY_ENV per Netlify context
scripts/
  og-image.js             Satori + resvg → /og/<slug>.png (1200×630), cached in .cache/og/
  markdown-math.js        markdown-it rule for $…$ / $$…$$ → MathJax SVG (mathjax-full, build-time)
  check-output.js         `npm test`
  fonts/*.ttf             build-time only (Satori can't read woff2); never served
src/
  _data/site.json         name, url, description, author, blog heading/intro, social links
  _includes/layouts/      base.njk (html shell, head/meta, header+footer includes, skip link)
                          home.njk (coming-soon page), blog-index.njk (/blog/), post.njk (article + prev/next)
  _includes/partials/     header.njk (brand + Blog link), footer.njk (© · GitHub · Email · RSS)
  index.njk               the coming-soon page body (layout: home)
  blog/blog.11tydata.js   directory data for posts: layout, tags, permalink, required-frontmatter check, draft/future rules
  blog/index.njk          /blog/ (layout: blog-index)
  blog/<slug>.md          a post → /blog/<slug>/
  blog/<slug>/index.md    a post with images beside it → /blog/<slug>/ (images copied to /blog/<slug>/)
  blog/_sample/index.md   draft regression fixture exercising every Markdown feature — never published, do not delete
  feed.njk → /feed.xml    Atom feed (all published posts)
  sitemap.njk → /sitemap.xml
  css/tokens.css          @font-face + all design tokens (colours, fonts, code palette). Change colours/type here.
  css/base.css            reset, focus styles, .visually-hidden, skip link, reduced-motion override
  css/site.css            shared frame: atmosphere, header (+ .site-nav), coming-soon page, footer, entrance animation
  css/blog.css            blog only: index list, post typography, Prism tokens, images, tables, footnotes, MathJax, prev/next
  js/main.js              .is-ready reveal gate, [data-year], waitlist form enhancement
  _headers                Netlify headers incl. the strict CSP and cache rules (passthrough)
  robots.txt, fonts/, images/   passthrough
```

CSS load order is tokens → base → site (→ blog on blog pages only).

## Adding a post

1. Create `src/blog/my-post-title.md` — or `src/blog/my-post-title/index.md` with images next to it. The filename/folder is the slug and the URL (`/blog/my-post-title/`); override with a `permalink` in frontmatter if needed.
2. Frontmatter (all three required — the build throws if one is missing):
   ```yaml
   ---
   title: "Post title"
   description: "One sentence used on the index, <meta description>, OG and the feed."
   date: 2026-09-01
   draft: true        # optional; remove (or set false) to publish
   ---
   ```
3. `npm run dev` → `http://localhost:8080/blog/my-post-title/`.
4. Remove `draft`, make sure `date` is today or earlier, push to `main`. OG image, feed, sitemap and prev/next update automatically.

Markdown supports: headings (ids generated, no anchor links), bold/italic, links (external ones get `rel="noopener"`), blockquotes, lists, fenced code with Prism highlighting (`solidity`, `rust`, `bash`, `toml`, `json`, `diff`, `typescript`, `python`, `yaml` + Prism defaults; the fence language is shown as a label), images `![alt](./img.png "caption")` → `<figure>` with width/height read at build, tables (wrapped for horizontal scroll; column alignment via `:---:`), footnotes `[^1]`, inline `$…$` and display `$$…$$` math.

**Draft / preview rules** (`src/blog/blog.11tydata.js`): a post with `draft: true` **or** a `date` in the future is excluded from the index, feed, sitemap, prev/next and OG generation, and is not written to `_site` — in production. In `npm run dev` and in Netlify Deploy Previews / branch deploys (`ELEVENTY_ENV=preview`, set in `netlify.toml`) those posts **are** rendered so they can be reviewed.

## Hard constraints

- **CSP is strict** (`src/_headers`): `default-src 'self'; style-src 'self'; script-src 'self'` … — no inline `<style>`/`<script>`, no `style=""` or `on*=""` attributes, no CDNs, no external fonts. `npm test` fails the build on any of these in `_site/**/*.html`. Anything that would emit inline styles (e.g. KaTeX) is off the table; MathJax SVG output has its `vertical-align` style converted to a class by a transform in `eleventy.config.js`.
- The waitlist `<form>` in `src/index.njk` must keep `name="waitlist"`, `data-netlify="true"`, the hidden `form-name` input and the `bot-field` honeypot — Netlify detects the form from the built HTML. After changing anything about the form or the publish setup, confirm the form is still registered in the Netlify UI.
- Fonts are cached immutable for a year: rename font files instead of editing them in place. New faces need a `@font-face` in `tokens.css` and a Latin-subset woff2 in `src/fonts/`.
- Root-relative URLs (`/css/site.css`) throughout; canonical host is `https://www.web3evals.com/`.
- Motion respects `prefers-reduced-motion` (override in `base.css`; JS checks `matchMedia`). Blog pages have no entrance animation.
- Design direction: warm dark background + cream text, Instrument Serif for headlines, Inter for body (400/500/600 + 400 italic), JetBrains Mono for small labels. Colours come exclusively from `tokens.css`.

## Deliberately not in v1

Categories/tags, author profiles, reading time, cover images, ToC, heading anchor links, end-of-post CTA, share buttons, comments, search, analytics, JSON-LD, a custom 404 page, year grouping on the index. See `BLOG_SPEC.md`.
