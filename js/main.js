document.documentElement.classList.add("js");

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

const revealItems = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10%", threshold: 0.08 },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const form = document.querySelector(".waitlist-form");

if (form) {
  const button = form.querySelector("button");
  const buttonCopy = form.querySelector(".button-copy");
  const status = form.querySelector(".form-status");
  const formRow = form.querySelector(".form-row");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    buttonCopy.textContent = "Sending";
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

      formRow.hidden = true;
      form.querySelector("label[for='email']").hidden = true;
      status.textContent = "Registered — you’re on the list.";
      status.hidden = false;
      form.reset();
    } catch (_) {
      button.disabled = false;
      buttonCopy.textContent = "Join waitlist";
      status.textContent = "Something went wrong — please try again.";
      status.classList.add("error");
      status.hidden = false;
    }
  });
}
