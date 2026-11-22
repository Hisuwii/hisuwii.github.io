import { WORKS, fmtTime, type Work } from "./data";
import { el, esc, reducedMotion } from "./util";

const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
let visible: Work[] = WORKS;

/* ---------------- grid + filters ---------------- */

function tagClass(label: string) {
  // stable colour per label
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return "t" + (h % 5);
}

function card(w: Work): HTMLElement {
  const c = el("button", "card");
  c.type = "button";
  c.dataset.id = w.id;
  c.setAttribute("aria-label", `Play ${w.title}`);
  c.innerHTML = `
    <div class="thumb">
      <img src="${w.poster}" alt="" loading="lazy" decoding="async" ${w.vertical ? 'width="540" height="960"' : 'width="1280" height="720"'}>
      <span class="play" aria-hidden="true"></span>
      ${w.duration ? `<span class="dur">${fmtTime(w.duration)}</span>` : ""}
    </div>
    <div class="meta">
      <span class="tag ${tagClass(w.label)}">${esc(w.label)}</span>
      <h3>${esc(w.title)}</h3>
      <p>${esc(w.desc)}</p>
    </div>`;
  c.addEventListener("click", () => openWork(w.id));
  if (w.preview && !reducedMotion()) attachPreview(c, w);
  return c;
}

function attachPreview(c: HTMLElement, w: Work) {
  let v: HTMLVideoElement | null = null;
  const start = () => {
    if (!v) {
      v = el("video");
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "auto";
      v.setAttribute("aria-hidden", "true");
      v.src = w.preview;
      c.querySelector(".thumb")!.insertBefore(v, c.querySelector(".play"));
    }
    v.play().then(() => c.classList.add("playing")).catch(() => {});
  };
  const stop = () => {
    c.classList.remove("playing");
    v?.pause();
  };
  if (canHover) {
    c.addEventListener("pointerenter", start);
    c.addEventListener("pointerleave", stop);
    c.addEventListener("focus", start);
    c.addEventListener("blur", stop);
  } else {
    inView.set(c, { start, stop });
    viewObserver.observe(c);
  }
}

// touch devices: play the preview while the card is mostly in view
const inView = new Map<Element, { start: () => void; stop: () => void }>();
const viewObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const h = inView.get(e.target);
      if (!h) continue;
      e.isIntersecting && e.intersectionRatio >= 0.7 ? h.start() : h.stop();
    }
  },
  { threshold: [0, 0.7] },
);

export function initWork() {
  const long = document.getElementById("long")!;
  const shorts = document.getElementById("shorts")!;
  const chips = document.getElementById("chips")!;
  const empty = document.getElementById("empty")!;
  const shortsHead = document.getElementById("shorts-head")!;
  const longHead = document.getElementById("long-head")!;

  const cards = new Map<string, HTMLElement>();
  for (const w of WORKS) {
    const c = card(w);
    cards.set(w.id, c);
    (w.vertical ? shorts : long).appendChild(c);
  }

  // tags ordered by how often they occur
  const count = new Map<string, number>();
  for (const w of WORKS) for (const t of w.tags) count.set(t, (count.get(t) || 0) + 1);
  const pinned = ["Long-form", "Shorts"].filter((t) => count.has(t));
  const rest = [...count.entries()].filter(([t]) => !pinned.includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  // keep the filter bar short: the main formats + the most common categories
  const tags = ["All", ...pinned, ...rest.filter((t) => (count.get(t) || 0) > 1).slice(0, 5)];
  for (const t of tags) {
    const b = el("button", "chip");
    b.type = "button";
    b.dataset.tag = t;
    b.innerHTML = `${esc(t)}<small>${t === "All" ? WORKS.length : count.get(t)}</small>`;
    b.setAttribute("aria-pressed", String(t === "All"));
    b.addEventListener("click", () => applyFilter(t));
    chips.appendChild(b);
  }

  function applyFilter(tag: string) {
    chips.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
    visible = WORKS.filter((w) => tag === "All" || w.tags.includes(tag));
    for (const w of WORKS) cards.get(w.id)!.classList.toggle("is-hidden", !visible.includes(w));
    const anyShort = visible.some((w) => w.vertical);
    shortsHead.hidden = !anyShort;
    shorts.hidden = !anyShort;
    long.hidden = !visible.some((w) => !w.vertical);
    longHead.hidden = long.hidden;
    empty.hidden = visible.length > 0;
  }
  applyFilter("All");

  shortsHead.querySelectorAll<HTMLButtonElement>("[data-scroll]").forEach((b) =>
    b.addEventListener("click", () =>
      shorts.scrollBy({ left: Number(b.dataset.scroll) * shorts.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" }),
    ),
  );

  initLightbox();
}

/* ---------------- lightbox ---------------- */

const modal = () => document.getElementById("modal")!;
let current: Work | null = null;
let lastFocus: HTMLElement | null = null;

function order(): Work[] {
  // same order as on screen: long-form grid first, then the shorts row
  const list = visible.length ? visible : WORKS;
  return [...list.filter((w) => !w.vertical), ...list.filter((w) => w.vertical)];
}

export function openWork(id: string, fromHash = false) {
  const w = WORKS.find((x) => x.id === id);
  if (!w) return;
  const m = modal();
  if (m.hidden) {
    lastFocus = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
  }
  current = w;
  const panel = document.getElementById("modal-panel")!;
  panel.classList.toggle("vertical", w.vertical);

  const player = document.getElementById("m-player")!;
  player.hidden = false;
  player.innerHTML = w.youtube
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(w.youtube)}?autoplay=1&rel=0&modestbranding=1"
         title="${esc(w.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : `<video src="${w.web}" poster="${w.poster}" controls autoplay playsinline preload="auto"></video>`;

  document.getElementById("m-meta")!.innerHTML =
    `<span class="tag ${tagClass(w.label)}">${esc(w.label)}</span>` +
    (w.duration ? `<span>${fmtTime(w.duration)}</span>` : "") +
    `<span>${w.vertical ? "9:16" : "16:9"}</span>` +
    (w.timelineItems ? `<span>${w.timelineItems} timeline items</span>` : "");
  document.getElementById("m-title")!.textContent = w.title;
  document.getElementById("m-desc")!.textContent = w.desc;
  document.getElementById("m-points")!.innerHTML = (w.points || []).map((p) => `<li>${esc(p)}</li>`).join("");
  document.getElementById("m-styles")!.innerHTML = (w.styles || []).map((s) => `<span>${esc(s)}</span>`).join("");

  const bd = document.getElementById("m-breakdown")!;
  const bdBtn = document.getElementById("m-breakdown-btn") as HTMLButtonElement;
  bd.hidden = true;
  bd.innerHTML = "";
  bdBtn.hidden = !w.breakdown;
  bdBtn.setAttribute("aria-expanded", "false");
  bdBtn.textContent = "View edit breakdown";

  const list = order();
  const multi = list.length > 1;
  (document.getElementById("m-prev") as HTMLButtonElement).hidden = !multi;
  (document.getElementById("m-next") as HTMLButtonElement).hidden = !multi;

  m.hidden = false;
  if (!fromHash && location.hash !== `#work/${w.id}`) history.pushState(null, "", `#work/${w.id}`);
  (m.querySelector(".m-close") as HTMLElement).focus({ preventScroll: true });
}

function closeWork(updateHash = true) {
  const m = modal();
  if (m.hidden) return;
  m.hidden = true;
  document.getElementById("m-player")!.innerHTML = "";
  document.getElementById("m-breakdown")!.innerHTML = "";
  document.body.style.overflow = "";
  current = null;
  if (updateHash && location.hash.startsWith("#work/")) history.pushState(null, "", "#work");
  lastFocus?.focus({ preventScroll: true });
}

function step(dir: number) {
  if (!current) return;
  const list = order();
  const i = list.findIndex((w) => w.id === current!.id);
  const next = list[(i + dir + list.length) % list.length];
  history.replaceState(null, "", `#work/${next.id}`);
  openWork(next.id, true);
}

function toggleBreakdown() {
  if (!current?.breakdown) return;
  const bd = document.getElementById("m-breakdown")!;
  const player = document.getElementById("m-player")!;
  const btn = document.getElementById("m-breakdown-btn")!;
  const show = bd.hidden;
  if (show && !bd.innerHTML) {
    bd.innerHTML = `<p>Contact sheet: one frame per shot, in timeline order.</p>
      <img src="${current.breakdown}" alt="Edit breakdown: a frame from every shot of ${esc(current.title)}" loading="lazy">`;
  }
  bd.hidden = !show;
  player.hidden = show;
  player.querySelector("video")?.pause();
  btn.setAttribute("aria-expanded", String(show));
  btn.textContent = show ? "Back to the video" : "View edit breakdown";
}

function fromHash() {
  const m = location.hash.match(/^#work\/([\w-]+)$/);
  if (m) {
    if (current?.id !== m[1]) openWork(m[1], true);
  } else closeWork(false);
}

function initLightbox() {
  const m = modal();
  m.querySelectorAll("[data-close]").forEach((x) => x.addEventListener("click", () => closeWork()));
  document.getElementById("m-prev")!.addEventListener("click", () => step(-1));
  document.getElementById("m-next")!.addEventListener("click", () => step(1));
  document.getElementById("m-breakdown-btn")!.addEventListener("click", toggleBreakdown);

  document.addEventListener("keydown", (e) => {
    if (m.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeWork();
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !(e.target instanceof HTMLVideoElement)) {
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "Tab") {
      // focus trap
      const f = [...m.querySelectorAll<HTMLElement>("button, [href], video, iframe, [tabindex]:not([tabindex='-1'])")].filter(
        (x) => !x.hidden && !x.closest("[hidden]") && x.offsetParent !== null,
      );
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!m.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("hashchange", fromHash);
  window.addEventListener("popstate", fromHash);
  fromHash();
}
