import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import markdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import { imageSize } from "image-size";
import loadLanguages from "prismjs/components/index.js";

import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

import { generateOgImage } from "./scripts/og-image.js";
import markdownItMath from "./scripts/markdown-math.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");
const SITE_URL = "https://www.web3evals.com";

/**
 * Build environment.
 *   production → drafts + future-dated posts are dropped entirely
 *   preview    → drafts + future-dated posts are rendered (Netlify Deploy
 *                Previews / branch deploys set ELEVENTY_ENV=preview in
 *                netlify.toml; `eleventy --serve` also counts as preview so
 *                authors can look at a draft locally)
 */
function isPreview(runMode) {
  if (process.env.ELEVENTY_ENV === "preview") return true;
  if (process.env.ELEVENTY_ENV === "production") return false;
  return runMode === "serve" || runMode === "watch";
}

// ── Date formatting (UTC so a YAML `date: 2026-09-01` never shifts a day) ──

function fmtDate(date, style) {
  const d = date instanceof Date ? date : new Date(date);
  const opts =
    style === "long"
      ? { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
      : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

// ── Markdown ──────────────────────────────────────────────────────────────

function buildMarkdown() {
  const md = markdownIt({ html: true, linkify: true, typographer: true });

  md.use(markdownItFootnote);

  // MathJax → inline <svg> (see scripts/markdown-math.js). No stylesheet is
  // emitted; the few container rules live in css/blog.css. The per-equation
  // style="vertical-align" MathJax adds is converted to a class by
  // `stripInlineStyles` below (CSP: style-src 'self').
  md.use(markdownItMath);

  // Heading ids (no anchor links — declined). Allows manual deep links.
  md.core.ruler.push("heading_ids", (state) => {
    const seen = new Map();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "heading_open") continue;
      const inline = tokens[i + 1];
      const text = inline.children
        .filter((t) => t.type === "text" || t.type === "code_inline")
        .map((t) => t.content)
        .join("");
      let slug = text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      if (!slug) slug = "section";
      const n = seen.get(slug) || 0;
      seen.set(slug, n + 1);
      tokens[i].attrSet("id", n ? `${slug}-${n}` : slug);
    }
  });

  // External links → rel="noopener" (no target=_blank; reader's choice).
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href") || "";
    if (/^https?:\/\//i.test(href) && !href.startsWith(SITE_URL)) {
      tokens[idx].attrSet("rel", "noopener");
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Tables → <div class="table-wrap"> … </div>; column alignment as a class
  // instead of markdown-it's default style="text-align:…" (CSP).
  md.renderer.rules.table_open = () => '<div class="table-wrap">\n<table>\n';
  md.renderer.rules.table_close = () => "</table>\n</div>\n";
  for (const type of ["th_open", "td_open"]) {
    md.renderer.rules[type] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const style = token.attrGet("style");
      if (style) {
        const m = style.match(/text-align:\s*(left|right|center)/);
        token.attrs = token.attrs.filter(([k]) => k !== "style");
        if (m && m[1] !== "left") token.attrJoin("class", `align-${m[1]}`);
      }
      return self.renderToken(tokens, idx, options);
    };
  }

  // Images → <figure><img loading=lazy decoding=async width height><figcaption>
  // Width/height are read from the file at build time to prevent layout
  // shift. Relative paths resolve against the post's own directory and are
  // rewritten to the root-relative URL the passthrough copy will produce.
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    let src = token.attrGet("src") || "";
    const alt = self.renderInlineAsText(token.children || [], options, env);
    const title = token.attrGet("title");
    const inputPath = env && env.page && env.page.inputPath;

    let dims = null;
    if (!/^(https?:)?\/\//i.test(src) && !src.startsWith("data:")) {
      let abs;
      if (src.startsWith("/")) {
        abs = path.join(SRC, src);
      } else if (inputPath) {
        abs = path.resolve(path.dirname(inputPath), src);
        src = "/" + path.relative(SRC, abs).split(path.sep).join("/");
      }
      if (abs && fs.existsSync(abs)) {
        try {
          dims = imageSize(fs.readFileSync(abs));
        } catch {
          dims = null;
        }
      } else if (abs) {
        throw new Error(
          `[markdown] Image not found: ${src} (referenced from ${inputPath})`,
        );
      }
    }

    const attrs = [
      `src="${md.utils.escapeHtml(src)}"`,
      `alt="${md.utils.escapeHtml(alt)}"`,
      'loading="lazy"',
      'decoding="async"',
    ];
    if (dims && dims.width && dims.height) {
      attrs.push(`width="${dims.width}"`, `height="${dims.height}"`);
    }
    const img = `<img ${attrs.join(" ")}>`;
    const caption = title
      ? `<figcaption>${md.utils.escapeHtml(title)}</figcaption>`
      : "";
    return `<figure>${img}${caption}</figure>`;
  };

  // A paragraph that only contains a figure should not be wrapped in <p>.
  md.core.ruler.push("unwrap_figures", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (
        tokens[i].type === "paragraph_open" &&
        tokens[i + 1].type === "inline" &&
        tokens[i + 2].type === "paragraph_close" &&
        tokens[i + 1].children.length === 1 &&
        tokens[i + 1].children[0].type === "image"
      ) {
        tokens[i].hidden = true;
        tokens[i + 2].hidden = true;
      }
    }
  });

  return md;
}

// MathJax's SVG output carries style="vertical-align: …ex" on each <svg>
// (mathjax-full 3.2). Inline styles are blocked by the CSP, so the
// vertical-align is converted to a class (nearest 0.25ex — the class set
// lives in css/blog.css) and any other style="" on mjx-container/svg is
// dropped.
function vaClass(ex) {
  const q = Math.max(-4, Math.min(1, Math.round(ex * 4) / 4));
  const sign = q < 0 ? "m" : q > 0 ? "p" : "";
  return `mjx-va-${sign}${Math.abs(q).toFixed(2).replace(".", "-")}`;
}

function stripInlineStyles(html) {
  return html.replace(
    /<(mjx-container|svg)\b([^>]*?)\sstyle="([^"]*)"([^>]*)>/g,
    (m, tag, before, style, after) => {
      const va = style.match(/vertical-align:\s*(-?[\d.]+)ex/);
      const cls = va ? ` class="${vaClass(parseFloat(va[1]))}"` : "";
      return `<${tag}${before}${cls}${after}>`;
    },
  );
}

// ── Config ────────────────────────────────────────────────────────────────

export default function (eleventyConfig) {
  const preview = isPreview(process.env.ELEVENTY_RUN_MODE);
  const buildTime = new Date();

  eleventyConfig.addGlobalData("env", { preview, buildTime });
  eleventyConfig.addGlobalData("buildTime", buildTime);

  // Static passthrough
  for (const p of ["css", "fonts", "images", "js", "robots.txt", "_headers"]) {
    eleventyConfig.addPassthroughCopy(`src/${p}`);
  }
  // Post-local images live beside the post (src/blog/<slug>/*.png) and are
  // copied to /blog/<slug>/ — but only for posts that were actually published
  // in this build (drafts/future posts leave nothing in _site). The set of
  // published posts is collected by the `ogImage` shortcode below.
  const publishedPosts = new Map();
  eleventyConfig.on("eleventy.before", () => publishedPosts.clear());
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    for (const [slug, inputPath] of publishedPosts) {
      const postDir = path.dirname(inputPath);
      if (path.basename(postDir) !== slug) continue; // flat <slug>.md, no folder
      const outDir = path.join(ROOT, dir.output, "blog", slug);
      for (const f of fs.readdirSync(postDir)) {
        if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(f)) {
          fs.mkdirSync(outDir, { recursive: true });
          fs.copyFileSync(path.join(postDir, f), path.join(outDir, f));
        }
      }
    }
  });

  // Markdown
  const md = buildMarkdown();
  eleventyConfig.setLibrary("md", md);

  // Build-time syntax highlighting (Prism). Prism ships a Solidity grammar.
  eleventyConfig.addPlugin(pluginSyntaxHighlight, {
    init() {
      loadLanguages([
        "solidity",
        "rust",
        "toml",
        "bash",
        "json",
        "diff",
        "typescript",
        "python",
        "yaml",
      ]);
    },
    preAttributes: {
      "data-language": ({ language }) => language,
    },
  });

  eleventyConfig.addPlugin(pluginRss);

  // Strip any style="" that MathJax injects (see stripInlineStyles).
  eleventyConfig.addTransform("strip-inline-styles", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return stripInlineStyles(content);
    }
    return content;
  });

  // ── Collections ──
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByTag("post")
      .filter((p) => p.data.published !== false)
      .sort((a, b) => b.date - a.date),
  );

  // ── Filters ──
  eleventyConfig.addFilter("dateShort", (d) => fmtDate(d, "short").toUpperCase());
  eleventyConfig.addFilter("dateLong", (d) => fmtDate(d, "long"));
  eleventyConfig.addFilter("dateIso", isoDate);
  eleventyConfig.addFilter("absolute", (url) => new URL(url, SITE_URL).href);
  eleventyConfig.addFilter("rtrim", (s) => (typeof s === "string" ? s.replace(/\s+$/, "") : s));
  // "August 2026" — used by the research post hero meta row.
  eleventyConfig.addFilter("dateMonthYear", (d) => {
    const date = d instanceof Date ? d : new Date(d);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);
  });
  eleventyConfig.addFilter("startsWith", (s, prefix) =>
    typeof s === "string" ? s.startsWith(prefix) : false,
  );

  // ── OG image shortcode (async, on-disk cache keyed on slug+title+description)
  eleventyConfig.addAsyncShortcode("ogImage", async function (post) {
    // Eleventy still renders excluded templates (permalink:false) for
    // collections; do not generate anything for them.
    if (this.ctx && this.ctx.published === false) return "";
    const slug = post.fileSlug || this.page.fileSlug;
    publishedPosts.set(slug, this.page.inputPath);
    const outputDir = path.join(ROOT, "_site", "og");
    await generateOgImage({
      slug,
      title: post.title,
      description: post.description,
      date: fmtDate(post.date, "short"),
      outputDir,
      cacheDir: path.join(ROOT, ".cache", "og"),
      fontsDir: path.join(ROOT, "scripts", "fonts"),
    });
    return `/og/${slug}.png`;
  });

  eleventyConfig.setServerOptions({ showAllHosts: false });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md"],
  };
}
