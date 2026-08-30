// Per-post Open Graph image: Satori (JSX-less object tree → SVG) + resvg
// (SVG → PNG). Called from the `ogImage` async shortcode in
// eleventy.config.js. Fonts are the build-time TTF copies in
// scripts/fonts/ (Satori does not read woff2); they are never served.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const WIDTH = 1200;
const HEIGHT = 630;

// Colours mirror src/css/tokens.css.
const BG = "#121110";
const CREAM = "#EDE8DF";
const CREAM_BRIGHT = "#F7F3EA";
const FAINT = "#807A72";

let fontCache = null;

async function loadFonts(fontsDir) {
  if (fontCache) return fontCache;
  const read = (f) => fs.readFile(path.join(fontsDir, f));
  const [serif, sans, mono] = await Promise.all([
    read("InstrumentSerif-Regular.ttf"),
    read("Inter-Medium.ttf"),
    read("JetBrainsMono-Regular.ttf"),
  ]);
  fontCache = [
    { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
    { name: "Inter", data: sans, weight: 500, style: "normal" },
    { name: "JetBrains Mono", data: mono, weight: 400, style: "normal" },
  ];
  return fontCache;
}

const h = (type, props = {}, ...children) => {
  const node = { type, props: { ...props } };
  if (children.length === 1) node.props.children = children[0];
  else if (children.length > 1) node.props.children = children;
  return node;
};

function layout({ title, date }) {
  return h(
    "div",
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: BG,
        backgroundImage:
          "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(237,232,223,0.10), rgba(18,17,16,0) 70%)",
        color: CREAM,
        fontFamily: "Inter",
      },
    },
    // Brand row
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 14 } },
      h(
        "div",
        {
          style: {
            width: 26,
            height: 26,
            borderRadius: 13,
            border: `2px solid ${CREAM}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        h("div", {
          style: { width: 9, height: 9, borderRadius: 5, backgroundColor: CREAM },
        }),
      ),
      h(
        "div",
        { style: { fontSize: 26, fontWeight: 500, letterSpacing: "0.01em" } },
        "Web3Evals",
      ),
    ),
    // Title
    h(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: "Instrument Serif",
          fontSize: 64,
          lineHeight: 1.1,
          color: CREAM_BRIGHT,
          letterSpacing: "-0.01em",
          maxWidth: 1000,
          lineClamp: 3,
        },
      },
      title,
    ),
    // Footer line
    h(
      "div",
      {
        style: {
          fontFamily: "JetBrains Mono",
          fontSize: 20,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: FAINT,
        },
      },
      `WEB3EVALS.COM · ${date}`.toUpperCase(),
    ),
  );
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function generateOgImage({
  slug,
  title,
  description,
  date,
  outputDir,
  cacheDir,
  fontsDir,
}) {
  const key = crypto
    .createHash("sha1")
    .update(JSON.stringify({ v: 1, slug, title, description, date }))
    .digest("hex");
  const cached = path.join(cacheDir, `${key}.png`);
  const out = path.join(outputDir, `${slug}.png`);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  if (await exists(cached)) {
    await fs.copyFile(cached, out);
    return out;
  }

  const fonts = await loadFonts(fontsDir);
  const svg = await satori(layout({ title, date }), {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  })
    .render()
    .asPng();

  await fs.writeFile(cached, png);
  await fs.writeFile(out, png);
  return out;
}
