// Directory data for src/blog/. Applies to every post (.md) in this folder
// (and sub-folders such as src/blog/<slug>/index.md). The blog index page
// (index.njk) overrides layout/permalink in its own front matter and is
// excluded from collections.

const REQUIRED = ["title", "description", "date"];

function isPost(data) {
  const p = (data.page && data.page.inputPath) || "";
  return p.endsWith(".md");
}

export default {
  layout: "layouts/post.njk",
  tags: ["post"],
  permalink: "/blog/{{ page.fileSlug }}/",
  isBlog: true,
  eleventyComputed: {
    // Loud failure on missing frontmatter.
    published(data) {
      if (!isPost(data)) return true;
      const missing = REQUIRED.filter((k) => data[k] === undefined || data[k] === "");
      if (missing.length) {
        throw new Error(
          `[blog] ${data.page.inputPath} is missing required frontmatter: ${missing.join(", ")}`,
        );
      }
      if (!(data.page.date instanceof Date) || Number.isNaN(data.page.date.getTime())) {
        throw new Error(`[blog] ${data.page.inputPath} has an invalid \`date\``);
      }
      if (data.env.preview) return true;
      if (data.draft === true) return false;
      if (data.page.date.getTime() > data.env.buildTime.getTime()) return false;
      return true;
    },
    // Unpublished posts are not written to _site at all in production.
    permalink(data) {
      if (isPost(data) && data.published === false) return false;
      return data.permalink;
    },
    eleventyExcludeFromCollections(data) {
      if (data.eleventyExcludeFromCollections) return true;
      return isPost(data) && data.published === false;
    },
  },
};
