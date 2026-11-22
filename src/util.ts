export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const rm = matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = () => rm.matches;
