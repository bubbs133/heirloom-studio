// Fades elements in as they scroll into view.
const SELECTOR = [
  ".hero-copy",
  ".hero-scene",
  ".section-heading",
  ".demo-note",
  ".product-card",
  ".how-grid article",
  ".how-cta",
  ".artist-art",
  ".artist-copy",
  ".questions > div",
  ".faq-list details",
  ".review-section > *",
  ".contact-section .section-wrap > div",
  ".studio-intro",
  ".builder",
  "footer",
].join(",");

const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let observer;

function reveal() {
  // Skip the effect for reduced motion or very old browsers
  if (reduceMotion || !("IntersectionObserver" in window)) return;

  observer =
    observer ||
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target); // fade in once only
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

  document.querySelectorAll(SELECTOR).forEach((el) => {
    if (el.classList.contains("rv")) return; // already set up

    // Stagger siblings: 0s, .08s, .16s ... (capped at the 6th)
    const siblings = [...el.parentElement.children].filter((c) =>
      c.matches(SELECTOR),
    );
    el.style.setProperty("--d", Math.min(siblings.indexOf(el), 5) * 0.08 + "s");

    el.classList.add("rv");
    observer.observe(el);
  });
}

reveal();

// app.js redraws the product grid when live prices load.
// Fade the first set of cards in, but leave later redraws alone
// so the cards don't flash and fade a second time.
const products = document.getElementById("products");
if (products) {
  let firstDone = products.children.length > 0;
  new MutationObserver(() => {
    if (firstDone) return;
    reveal();
    firstDone = products.children.length > 0;
  }).observe(products, { childList: true });
}
