// markdown-it plugin: `$…$` (inline) and `$$…$$` (display) → MathJax SVG,
// rendered at build time with mathjax-full.
//
// Output is a bare <mjx-container jax="SVG" [display="true"]><svg>…</svg>
// </mjx-container> per equation. `fontCache: "none"` keeps every glyph path
// inside its own <svg> (no shared <defs>), and no stylesheet is emitted —
// the handful of container rules live in src/css/blog.css. The inline
// `style="vertical-align: …"` MathJax puts on each <svg> is converted to
// a class by the `strip-inline-styles` transform in eleventy.config.js.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: "none" });
const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });

export function renderTex(source, display) {
  const node = doc.convert(source, { display });
  // Accessible name: the TeX source (MathJax's assistive MathML is not
  // emitted in this setup).
  const label = source.trim().replace(/\s+/g, " ");
  for (const svgNode of adaptor.tags(node, "svg")) {
    adaptor.setAttribute(svgNode, "aria-label", label);
  }
  return adaptor.outerHTML(node);
}

// ── Inline: $…$ ───────────────────────────────────────────────────────────

function isValidOpen(state, pos) {
  const prev = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const next = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1;
  // "$ " is not an opener; "\$" is escaped.
  return prev !== 0x5c /* \ */ && next !== 0x20 && next !== 0x09 && next !== -1;
}

function isValidClose(state, pos) {
  const prev = state.src.charCodeAt(pos - 1);
  const next = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1;
  // " $" is not a closer; "$5" (followed by a digit) is not a closer.
  return prev !== 0x20 && prev !== 0x09 && !(next >= 0x30 && next <= 0x39);
}

function mathInline(state, silent) {
  if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
  if (!isValidOpen(state, state.pos)) {
    if (!silent) state.pending += "$";
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  let match = start;
  let pos;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    pos = match - 1;
    while (state.src[pos] === "\\") pos -= 1;
    if ((match - pos) % 2 === 1) break; // unescaped
    match += 1;
  }

  if (match === -1) {
    if (!silent) state.pending += "$";
    state.pos = start;
    return true;
  }
  if (match - start === 0) {
    if (!silent) state.pending += "$$";
    state.pos = start + 1;
    return true;
  }
  if (!isValidClose(state, match)) {
    if (!silent) state.pending += "$";
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }
  state.pos = match + 1;
  return true;
}

// ── Block: $$ … $$ ────────────────────────────────────────────────────────

function mathBlock(state, start, end, silent) {
  let pos = state.bMarks[start] + state.tShift[start];
  let max = state.eMarks[start];
  if (pos + 2 > max) return false;
  if (state.src.slice(pos, pos + 2) !== "$$") return false;

  pos += 2;
  let firstLine = state.src.slice(pos, max);
  if (silent) return true;

  let lastLine;
  let found = false;
  let next = start;

  if (firstLine.trim().endsWith("$$")) {
    // single-line $$ … $$
    firstLine = firstLine.trim().slice(0, -2);
    found = true;
  }

  while (!found) {
    next += 1;
    if (next >= end) break;
    pos = state.bMarks[next] + state.tShift[next];
    max = state.eMarks[next];
    if (pos < max && state.tShift[next] < state.blkIndent) break; // dedent
    const line = state.src.slice(pos, max);
    if (line.trim().endsWith("$$")) {
      const lastPos = state.src.slice(0, max).lastIndexOf("$$");
      lastLine = state.src.slice(pos, lastPos);
      found = true;
    }
  }

  state.line = next + 1;

  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content =
    (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : "");
  token.map = [start, state.line];
  token.markup = "$$";
  return true;
}

// ── Plugin ────────────────────────────────────────────────────────────────

export default function markdownItMath(md) {
  md.inline.ruler.after("escape", "math_inline", mathInline);
  md.block.ruler.after("blockquote", "math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.renderer.rules.math_inline = (tokens, idx) =>
    renderTex(tokens[idx].content, false);
  md.renderer.rules.math_block = (tokens, idx) =>
    renderTex(tokens[idx].content, true) + "\n";
}
