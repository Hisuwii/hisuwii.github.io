import { BEFORE_AFTER } from "./data";
import { reducedMotion } from "./util";

/** Before/after drag slider: two synced videos, the "before" one clipped to the left of the divider. */
export function initBeforeAfter() {
  const section = document.getElementById("before-after")!;
  const BA = BEFORE_AFTER;
  if (!BA) {
    section.hidden = true;
    document.querySelector('.nav-links a[href="#before-after"]')?.parentElement?.remove();
    return;
  }
  const box = document.getElementById("ba")!;
  const handle = document.getElementById("ba-handle")!;
  const before = document.getElementById("ba-before") as HTMLVideoElement;
  const after = document.getElementById("ba-after") as HTMLVideoElement;
  const playBtn = document.getElementById("ba-play") as HTMLButtonElement;
  const soundBtn = document.getElementById("ba-sound") as HTMLButtonElement;
  box.querySelector(".ba-label.left")!.textContent = "Before";
  box.querySelector(".ba-label.right")!.textContent = "After";
  box.setAttribute("aria-label", `${BA.beforeLabel} / ${BA.afterLabel}`);
  after.poster = BA.poster;

  let pos = 50;
  let sound = false;
  let wantPlay = !reducedMotion();
  let loaded = false;

  const setPos = (p: number) => {
    pos = Math.max(0, Math.min(100, p));
    box.style.setProperty("--pos", pos + "%");
    handle.setAttribute("aria-valuenow", String(Math.round(pos)));
    handle.setAttribute("aria-valuetext", `${Math.round(pos)}% before`);
    applySound();
  };
  const applySound = () => {
    before.muted = !sound || pos < 50;
    after.muted = !sound || pos >= 50;
  };

  // drag anywhere on the frame
  const fromEvent = (e: PointerEvent) => {
    const r = box.getBoundingClientRect();
    setPos(((e.clientX - r.left) / r.width) * 100);
  };
  box.addEventListener("pointerdown", (e) => {
    box.setPointerCapture(e.pointerId);
    fromEvent(e);
    handle.focus({ preventScroll: true });
    const move = (ev: PointerEvent) => fromEvent(ev);
    const up = () => {
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
  });
  handle.addEventListener("keydown", (e) => {
    const k: Record<string, number> = { ArrowLeft: pos - 5, ArrowRight: pos + 5, Home: 0, End: 100, PageDown: pos - 20, PageUp: pos + 20 };
    if (e.key in k) {
      e.preventDefault();
      setPos(k[e.key]);
    }
  });

  // keep both halves on the same frame
  const sync = () => {
    if (Math.abs(before.currentTime - after.currentTime) > 0.12) before.currentTime = after.currentTime;
  };
  after.addEventListener("timeupdate", sync);
  after.addEventListener("seeked", sync);
  after.addEventListener("play", () => { before.play().catch(() => {}); playBtn.textContent = "Pause"; });
  after.addEventListener("pause", () => { before.pause(); playBtn.textContent = "Play"; });

  const load = () => {
    if (loaded) return;
    loaded = true;
    before.src = BA.before;
    after.src = BA.after;
  };
  const play = () => {
    load();
    Promise.all([after.play(), before.play()]).catch(() => {});
  };

  playBtn.textContent = wantPlay ? "Pause" : "Play";
  playBtn.addEventListener("click", () => {
    wantPlay = after.paused;
    wantPlay ? play() : after.pause();
  });
  soundBtn.addEventListener("click", () => {
    sound = !sound;
    soundBtn.setAttribute("aria-pressed", String(sound));
    soundBtn.textContent = sound ? "Sound: on" : "Sound: off";
    applySound();
    if (sound && after.paused) {
      wantPlay = true;
      play();
    }
  });

  // load when near the viewport, play only while visible
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) {
        load();
        if (wantPlay) play();
      } else if (loaded) after.pause();
    },
    { rootMargin: "150px 0px", threshold: 0.25 },
  ).observe(box);

  setPos(50);
}
