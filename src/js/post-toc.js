// Scroll-spy for the post table of contents: highlights the entry whose
// section heading was most recently scrolled past. Loaded only on post
// pages; exits immediately when there is no TOC.
(function () {
  "use strict";

  var toc = document.querySelector(".post-toc");
  if (!toc) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  var targets = links
    .map(function (a) {
      return document.getElementById(
        decodeURIComponent(a.getAttribute("href").slice(1)),
      );
    })
    .filter(Boolean);
  if (!targets.length) return;

  var current = null;
  function setActive(id) {
    if (id === current) return;
    current = id;
    links.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + id);
    });
  }

  function onScroll() {
    var line = 120;
    var best = targets[0];
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top - line <= 0) {
        best = targets[i];
      }
    }
    setActive(best.id);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
