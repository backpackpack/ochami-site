(() => {
  const d = document.documentElement;
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const sel = ".section .h2, .archive-head, .nights-head p, .posters > li, .all-events, .tile, .places li, .year, .facts > div, .onesheet, .fr, .statement, .about-body, .lede-c, .mail, .socials, .reply, .events-head, .month > h2, .erow, .event-poster, .event-info, .events-foot";
  const els = [...document.querySelectorAll(sel)].filter((el) => !el.closest(".hero"));
  if (!els.length) return;
  d.classList.add("rv");
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); io.unobserve(e.target);
  }), { rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => {
    let i = [...el.parentElement.children].indexOf(el);
    if (el.classList.contains("tile")) i = parseInt(el.style.gridColumn, 10) || 0;
    el.style.setProperty("--d", Math.min(i, 8) * (el.classList.contains("tile") ? 45 : 80) + "ms");
    el.classList.add("rv-i"); io.observe(el);
  });
})();
