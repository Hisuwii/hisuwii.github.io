import worksFile from "../works.json";
import mediaFile from "./generated/media.json";

export interface WorkEntry {
  id: string;
  title: string;
  label: string;
  format: "16:9" | "9:16";
  tags: string[];
  year?: number;
  desc: string;
  points?: string[];
  styles?: string[];
  youtube?: string;
}

interface MediaEntry {
  duration: number;
  vertical: boolean;
  web: string;
  preview: string;
  poster: string;
  breakdown: string | null;
  timelineItems: number | null;
}

export interface Work extends WorkEntry {
  vertical: boolean;
  duration: number;
  web: string;
  preview: string;
  poster: string;
  breakdown: string | null;
  timelineItems: number | null;
}

const media = mediaFile as unknown as {
  works: Record<string, MediaEntry>;
  beforeAfter?: { before: string; after: string; poster: string; duration: number };
  showreel?: { video: string; poster: string };
};

/** works.json entries joined with what the media script generated; entries without media are skipped */
export const WORKS: Work[] = (worksFile.works as unknown as WorkEntry[])
  .filter((w) => media.works[w.id] || w.youtube)
  .map((w) => {
    const m = media.works[w.id];
    return {
      ...w,
      vertical: w.format ? w.format === "9:16" : !!m?.vertical,
      duration: m?.duration ?? 0,
      web: m?.web ?? "",
      preview: m?.preview ?? "",
      poster: m?.poster ?? (w.youtube ? `https://i.ytimg.com/vi/${w.youtube}/hqdefault.jpg` : ""),
      breakdown: m?.breakdown ?? null,
      timelineItems: m?.timelineItems ?? null,
    };
  });

const baConf = (worksFile as { beforeAfter?: { beforeLabel?: string; afterLabel?: string } }).beforeAfter ?? {};
export const BEFORE_AFTER = media.beforeAfter
  ? { ...media.beforeAfter, beforeLabel: baConf.beforeLabel ?? "Before", afterLabel: baConf.afterLabel ?? "After" }
  : null;
export const SHOWREEL = media.showreel ?? null;

export const fmtTime = (s: number) => {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
