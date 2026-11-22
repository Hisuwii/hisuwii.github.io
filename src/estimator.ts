import { CONFIG, PRICE_EXTRAS, PRICE_TYPES } from "./config";
import { el, esc } from "./util";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: CONFIG.CURRENCY, maximumFractionDigits: 0 }).format(n);
const range = ([a, b]: [number, number]) => (a === b ? money(a) : `${money(a)}–${money(b)}`);
const fmtLen = (m: number) => (m < 1 ? `${Math.round(m * 60)} s` : m % 1 ? `${Math.floor(m)} min ${Math.round((m % 1) * 60)} s` : `${m} min`);

export function initEstimator() {
  const form = document.getElementById("estimator") as HTMLFormElement;
  const types = document.getElementById("est-types")!;
  const len = document.getElementById("est-len") as HTMLInputElement;
  const lenOut = document.getElementById("est-len-out")!;
  const extrasBox = document.getElementById("est-extras")!;
  const priceOut = document.getElementById("est-price")!;
  const list = document.getElementById("est-breakdown")!;
  const notes = document.getElementById("est-notes") as HTMLTextAreaElement;

  PRICE_TYPES.forEach((t, i) => {
    const l = el("label");
    l.innerHTML = `<input type="radio" name="type" value="${t.id}" ${i === 0 ? "checked" : ""}><span>${esc(t.label)}</span>`;
    types.appendChild(l);
  });
  for (const x of PRICE_EXTRAS) {
    const row = el("div");
    const units = x.unit
      ? `<select data-units="${x.id}" aria-label="Number of ${x.unit}s">${Array.from({ length: x.maxUnits || 5 }, (_, i) => `<option>${i + 1}</option>`).join("")}</select>`
      : "";
    const price = x.multiplier ? `×${x.multiplier}` : x.price[1] === 0 ? "free" : range(x.price) + (x.unit ? ` / ${x.unit}` : "");
    row.innerHTML = `<label><input type="checkbox" name="extra" value="${x.id}"><span class="box-ui" aria-hidden="true"></span>${esc(x.label)}</label>
      ${units}<span class="price">${price}</span>`;
    extrasBox.appendChild(row);
  }

  const type = () => PRICE_TYPES.find((t) => t.id === (form.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value))!;
  let lastType = "";

  function calc() {
    const t = type();
    if (t.id !== lastType) {
      lastType = t.id;
      len.min = String(t.minMinutes);
      len.max = String(t.maxMinutes);
      len.step = String(t.step);
      len.value = String(t.defaultMinutes);
    }
    const minutes = Number(len.value);
    lenOut.textContent = fmtLen(minutes);
    len.setAttribute("aria-valuetext", fmtLen(minutes));

    const extraMin = Math.max(0, minutes - t.baseMinutes);
    let lo = t.base[0] + extraMin * t.perMinute[0];
    let hi = t.base[1] + extraMin * t.perMinute[1];
    const lines: [string, string][] = [[`${t.label}, ${fmtLen(minutes)}`, range([lo, hi])]];
    let mult = 1;
    const chosen: string[] = [];
    for (const x of PRICE_EXTRAS) {
      if (!form.querySelector<HTMLInputElement>(`input[value="${x.id}"]`)!.checked) continue;
      if (x.multiplier) {
        mult *= x.multiplier;
        lines.push([x.label, `×${x.multiplier}`]);
        chosen.push(x.label);
        continue;
      }
      const n = x.unit ? Number(form.querySelector<HTMLSelectElement>(`select[data-units="${x.id}"]`)!.value) : 1;
      lo += x.price[0] * n;
      hi += x.price[1] * n;
      lines.push([x.unit ? `${x.label} × ${n}` : x.label, x.price[1] === 0 ? "free" : range([x.price[0] * n, x.price[1] * n])]);
      chosen.push(x.unit ? `${x.label} × ${n}` : x.label);
    }
    lo = Math.round((lo * mult) / 5) * 5;
    hi = Math.round((hi * mult) / 5) * 5;
    priceOut.textContent = range([lo, hi]);
    list.innerHTML = lines.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join("");
    return { t, minutes, chosen, lo, hi };
  }

  form.addEventListener("input", calc);
  form.addEventListener("change", calc);
  calc();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = calc();
    const subject = `Video edit brief: ${r.t.label} (${fmtLen(r.minutes)})`;
    const body = [
      "Hi,",
      "",
      "I'd like a quote for this edit:",
      `- Type: ${r.t.label}`,
      `- Finished length: ${fmtLen(r.minutes)}`,
      `- Extras: ${r.chosen.length ? r.chosen.join(", ") : "none"}`,
      `- Estimate from your site: ${range([r.lo, r.hi])}`,
      "",
      notes.value.trim() ? `Notes: ${notes.value.trim()}` : "Channel / reference video: ",
      "",
      "Thanks!",
    ].join("\n");
    location.href = `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // extra contact buttons (hidden while the URLs are empty)
  const links = document.getElementById("contact-links")!;
  const add = (href: string, label: string) => {
    if (!href) return;
    const a = el("a", "btn ghost small");
    a.href = href;
    if (href.startsWith("http")) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    a.textContent = label;
    links.appendChild(a);
  };
  add(`mailto:${CONFIG.EMAIL}`, "Email me");
  add(CONFIG.ONLINEJOBS_URL, "OnlineJobs.ph");
  add(CONFIG.UPWORK_URL, "Upwork");
}
