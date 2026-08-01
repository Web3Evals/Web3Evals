// Entrance reveal: default (no-JS) state is fully visible; adding
// .is-ready opts into the one-time staggered fade-up defined in CSS.
document.documentElement.classList.add("is-ready");

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

const form = document.querySelector(".waitlist");

if (form) {
  const pill = form.querySelector(".pill");
  const microcopy = form.querySelector(".form-microcopy");
  const button = form.querySelector("button[type='submit']");
  const status = form.querySelector(".form-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "Sending…";
    status.hidden = true;
    status.classList.remove("error");

    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Morph in place: fade the pill + microcopy out, then replace
      // them with the confirmation. Removing the interactive form
      // controls prevents double submits.
      pill.classList.add("is-leaving");
      microcopy.classList.add("is-leaving");
      await new Promise((resolve) =>
        setTimeout(resolve, reducedMotion.matches ? 0 : 250),
      );
      pill.remove();
      microcopy.remove();

      status.classList.add("form-confirm");
      status.innerHTML =
        '<span aria-hidden="true">✓ </span>You’re on the list. One email when results go live.';
      status.hidden = false;
    } catch (_) {
      button.disabled = false;
      button.textContent = "Notify me";
      status.classList.add("error");
      status.innerHTML =
        "Something went wrong — please try again, or email <a href=\"mailto:contact@web3evals.com\">contact@web3evals.com</a>.";
      status.hidden = false;
    }
  });
}
