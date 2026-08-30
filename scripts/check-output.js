// `npm test` — static checks on the built site (_site/).
//
//  1. No inline <style>, <script> bodies, style="" or on*="" attributes in
//     any HTML file (the CSP is default-src 'self'; style-src 'self';
//     script-src 'self').
//  2. Every post page has canonical, description, og:image (pointing at an
//     existing 1200×630 PNG), article:published_time and the Atom
//     <link rel="alternate">.
//  3. feed.xml and sitemap.xml exist and list every post that was written.
//
// Run `npm run build` first.

import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

const SITE = path.resolve("_site");
let failures = 0;

function fail(msg) {
  failures++;
  console.error("✗ " + msg);
}
function ok(msg) {
  console.log("✓ " + msg);
}

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

if (!fs.existsSync(SITE)) {
  console.error("_site/ not found — run `npm run build` first.");
  process.exit(1);
}

const htmlFiles = walk(SITE, ".html");
if (htmlFiles.length === 0) fail("no HTML files in _site/");

// ── 1. CSP-hostile markup ──
const cspPatterns = [
  [/<style[\s>]/i, "inline <style>"],
  [/<script(?![^>]*\ssrc=)[^>]*>/i, "inline <script>"],
  [/\sstyle\s*=\s*["']/i, 'style="" attribute'],
  [/\son[a-z]+\s*=\s*["']/i, 'on*="" handler attribute'],
];
let cspClean = true;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  for (const [re, label] of cspPatterns) {
    const m = html.match(re);
    if (m) {
      cspClean = false;
      const line = html.slice(0, m.index).split("\n").length;
      fail(`${path.relative(SITE, file)}:${line} contains ${label}: ${m[0].slice(0, 60)}`);
    }
  }
}
if (cspClean) ok(`${htmlFiles.length} HTML files contain no inline style/script/on* markup`);

// ── 2. Post page metadata ──
const postFiles = htmlFiles.filter((f) => {
  const rel = path.relative(SITE, f);
  return rel.startsWith("blog" + path.sep) && rel !== path.join("blog", "index.html");
});

const attr = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : null;
};

const postUrls = [];
for (const file of postFiles) {
  const rel = path.relative(SITE, file);
  const html = fs.readFileSync(file, "utf8");
  const url = "/" + path.dirname(rel).split(path.sep).join("/") + "/";
  postUrls.push(url);

  const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/);
  const description = attr(html, /<meta name="description" content="([^"]*)"/);
  const ogImage = attr(html, /<meta property="og:image" content="([^"]+)"/);
  const published = attr(html, /<meta property="article:published_time" content="([^"]+)"/);
  const feedLink = /<link rel="alternate" type="application\/atom\+xml"[^>]*href="\/feed\.xml"/.test(html);

  if (!canonical) fail(`${rel}: missing canonical`);
  if (!description) fail(`${rel}: missing meta description`);
  if (!published) fail(`${rel}: missing article:published_time`);
  if (!feedLink) fail(`${rel}: missing Atom <link rel="alternate">`);
  if (!ogImage) {
    fail(`${rel}: missing og:image`);
  } else {
    const local = path.join(SITE, new URL(ogImage).pathname);
    if (!fs.existsSync(local)) {
      fail(`${rel}: og:image ${ogImage} does not exist in _site`);
    } else {
      const { width, height } = imageSize(fs.readFileSync(local));
      if (width !== 1200 || height !== 630) {
        fail(`${rel}: og:image is ${width}×${height}, expected 1200×630`);
      }
    }
  }
}
if (postFiles.length) ok(`${postFiles.length} post page(s) have canonical/description/og:image/published_time/feed link`);
else ok("no post pages in this build (nothing published yet)");

// ── 3. Feed + sitemap ──
for (const name of ["feed.xml", "sitemap.xml"]) {
  const p = path.join(SITE, name);
  if (!fs.existsSync(p)) {
    fail(`${name} missing`);
    continue;
  }
  const xml = fs.readFileSync(p, "utf8");
  const missing = postUrls.filter((u) => !xml.includes("https://www.web3evals.com" + u));
  if (missing.length) fail(`${name} does not list: ${missing.join(", ")}`);
  else ok(`${name} lists all ${postUrls.length} post URL(s)`);
}

// Every page links the feed
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  if (!/<link rel="alternate" type="application\/atom\+xml"/.test(html)) {
    fail(`${path.relative(SITE, file)}: missing Atom feed <link>`);
  }
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
