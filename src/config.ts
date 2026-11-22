/**
 * EDIT ME: contact links, site URL and the price list for the quote estimator.
 * Everything the owner has to fill in lives in this one file.
 */
export const CONFIG = {
  NAME: "sui",
  /** Placeholder: replace with your real email before publishing. */
  EMAIL: "hisuwi.dev@gmail.com",
  /** Full profile URLs, e.g. "https://www.onlinejobs.ph/jobseekers/info/123456". Empty = button hidden. */
  ONLINEJOBS_URL: "",
  UPWORK_URL: "",
  /** Public URL of the deployed site (e.g. "https://<user>.github.io/<repo>/"), used for the social-preview image. */
  SITE_URL: "",
  CURRENCY: "USD",
};

export interface PriceType {
  id: string;
  label: string;
  /** price range for the base length below */
  base: [number, number];
  /** minutes included in the base price */
  baseMinutes: number;
  /** extra price per additional finished minute */
  perMinute: [number, number];
  minMinutes: number;
  maxMinutes: number;
  defaultMinutes: number;
  /** step of the length slider in minutes (0.25 = 15 s) */
  step: number;
}

/** Placeholder prices: adjust to your own rates. */
export const PRICE_TYPES: PriceType[] = [
  { id: "faceless", label: "Faceless YouTube / explainer", base: [40, 70], baseMinutes: 4, perMinute: [8, 14], minMinutes: 1, maxMinutes: 20, defaultMinutes: 6, step: 1 },
  { id: "documentary", label: "Documentary / history", base: [60, 100], baseMinutes: 4, perMinute: [12, 20], minMinutes: 2, maxMinutes: 30, defaultMinutes: 8, step: 1 },
  { id: "short", label: "Short / Reel / TikTok", base: [12, 25], baseMinutes: 0.5, perMinute: [10, 20], minMinutes: 0.25, maxMinutes: 1.5, defaultMinutes: 0.75, step: 0.25 },
  { id: "talking", label: "Talking head / podcast clip", base: [25, 45], baseMinutes: 3, perMinute: [6, 10], minMinutes: 1, maxMinutes: 60, defaultMinutes: 10, step: 1 },
  { id: "ad", label: "Product / UGC ad", base: [30, 60], baseMinutes: 0.5, perMinute: [20, 40], minMinutes: 0.25, maxMinutes: 2, defaultMinutes: 0.5, step: 0.25 },
];

export interface PriceExtra {
  id: string;
  label: string;
  /** flat price range, or per-unit when `unit` is set */
  price: [number, number];
  unit?: string;
  maxUnits?: number;
  /** multiply the whole subtotal instead of adding (rush) */
  multiplier?: number;
}

export const PRICE_EXTRAS: PriceExtra[] = [
  { id: "captions", label: "Word-by-word captions + SRT", price: [5, 15] },
  { id: "thumbnail", label: "Thumbnail design", price: [10, 20] },
  { id: "shorts", label: "Shorts cut-downs", price: [10, 18], unit: "short", maxUnits: 5 },
  { id: "premiere", label: "Premiere project file (free)", price: [0, 0] },
  { id: "rush", label: "Rush delivery (< 24 h)", price: [0, 0], multiplier: 1.5 },
];
