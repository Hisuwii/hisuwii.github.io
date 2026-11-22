import { SHOWREEL, WORKS } from "./data";
import { el, esc, reducedMotion } from "./util";
import { CONFIG } from "./config";

export function initTheme() {
  const btn = document.getElementById("theme-toggle")!;
  const root = document.documentElement;
  const label = () => btn.setAttribute("aria-label", `Switch to ${root.dataset.theme === "dark" ? "light" : "dark"} theme`);
  label();
  btn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch { /* private mode */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", root.dataset.theme === "dark" ? "#131312" : "#f7f5f0");
    label();
  });
}

export function initNav() {
  const menuBtn = document.getElementById("menu-btn")!;
  const links = document.getElementById("nav-links")!;
  const setOpen = (open: boolean) => {
    links.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  menuBtn.addEventListener("click", () => setOpen(!links.classList.contains("open")));
  links.addEventListener("click", (e) => { if ((e.target as Element).closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links.classList.contains("open")) { setOpen(false); menuBtn.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (links.classList.contains("open") && !(e.target as Element).closest("#nav")) setOpen(false);
  });

  // highlight the section currently in view
  const anchors = [...links.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections = anchors.map((a) => document.querySelector<HTMLElement>(a.getAttribute("href")!)).filter(Boolean) as HTMLElement[];
  const update = () => {
    const y = window.scrollY + window.innerHeight * 0.35;
    let active: HTMLElement | null = null;
    for (const s of sections) if (!s.hidden && s.offsetTop <= y) active = s;
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) active = sections[sections.length - 1];
    for (const a of anchors) {
      const on = !!active && a.getAttribute("href") === "#" + active.id;
      a.classList.toggle("active", on);
      on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
    }
  };
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); }
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
}

export function initReveal() {
  document.documentElement.classList.add("js");
  const items = document.querySelectorAll<HTMLElement>(".reveal");
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((i) => i.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((i, n) => {
    i.style.transitionDelay = `${(n % 4) * 60}ms`;
    io.observe(i);
  });
}

export function initHero() {
  const v = document.getElementById("hero-video") as HTMLVideoElement;
  const toggle = document.getElementById("reel-toggle") as HTMLButtonElement;
  if (!SHOWREEL) return;
  v.poster = SHOWREEL.poster;
  // skip the background reel on data-saver connections
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  v.src = SHOWREEL.video;
  toggle.hidden = false;
  const set = (paused: boolean) => {
    toggle.textContent = paused ? "Play reel" : "Pause reel";
    toggle.setAttribute("aria-pressed", String(paused));
  };
  if (reducedMotion()) {
    v.preload = "metadata";
    set(true);
  } else {
    v.play().then(() => set(false)).catch(() => set(true));
  }
  toggle.addEventListener("click", () => {
    if (v.paused) { v.play().catch(() => {}); set(false); } else { v.pause(); set(true); }
  });
  // don't burn CPU when the hero is off-screen
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) v.pause();
    else if (toggle.getAttribute("aria-pressed") === "false") v.play().catch(() => {});
  }).observe(v);
}

export function initStats() {
  const box = document.getElementById("stats")!;
  const edits = WORKS.filter((w) => !w.tags.includes("Before & after"));
  const minutes = edits.reduce((s, w) => s + w.duration, 0) / 60;
  const items = edits.reduce((s, w) => s + (w.timelineItems || 0), 0);
  const styles = new Set(edits.flatMap((w) => w.styles || [])).size;
  const shorts = edits.filter((w) => w.vertical).length;
  const stats: [number, string, string][] = [
    [edits.length, "", "videos edited"],
    [Math.round(minutes), " min", "of finished video"],
    [items, "", "clips, titles & effects placed"],
    [styles, "", "edit styles & effects"],
    [shorts, "", "vertical Shorts"],
  ];
  const nodes = stats.filter(([n]) => n > 0).map(([n, suffix, label]) => {
    const d = el("div", "stat reveal");
    d.innerHTML = `<b><span data-to="${n}">0</span><em>${suffix}</em></b><span>${label}</span>`;
    box.appendChild(d);
    return d.querySelector<HTMLElement>("[data-to]")!;
  });
  const run = (n: HTMLElement) => {
    const to = Number(n.dataset.to);
    if (reducedMotion()) { n.textContent = to.toLocaleString("en-US"); return; }
    const t0 = performance.now(), dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { nodes.forEach(run); io.disconnect(); }
  }, { threshold: 0.4 });
  io.observe(box);
}

/** Fills the visible contact details (email) and the "styles I can do" list from the data. */
export function initDetails() {
  for (const id of ["about-email", "contact-email"]) {
    const a = document.getElementById(id) as HTMLAnchorElement | null;
    if (!a) continue;
    a.href = `mailto:${CONFIG.EMAIL}`;
    a.textContent = CONFIG.EMAIL;
  }
  const box = document.getElementById("skills");
  if (!box) return;
  const count = new Map<string, number>();
  for (const w of WORKS) for (const s of w.styles || []) count.set(s, (count.get(s) || 0) + 1);
  box.innerHTML = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)
    .map(([s]) => `<span>${esc(s)}</span>`).join("");
}
