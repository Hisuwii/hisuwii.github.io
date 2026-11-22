#!/usr/bin/env node
/**
 * Media pipeline for the portfolio.
 *
 * Reads ../works.json and, for every work, writes into public/media/<id>/:
 *   web.mp4        H.264 720p (or 720x1280 for 9:16), CRF 27, faststart, AAC 128k
 *   preview.mp4    6 s muted hover loop starting at previewStart
 *   poster.jpg     from the packs thumbnail/cover if given, else a frame
 *   breakdown.jpg  the contact sheet, downscaled to <= 1600 px wide (optional)
 * plus public/media/before-after/{before,after}.mp4 and public/media/showreel.mp4,
 * and src/generated/media.json (durations, sizes, timeline item counts) used by the site.
 *
 * Outputs are skipped when they exist, are newer than their source and were made
 * with the same settings. Usage:
 *   node scripts/make_web_media.mjs            # everything
 *   node scripts/make_web_media.mjs ocean-facts space-qa   # only these ids (+ showreel)
 *   node scripts/make_web_media.mjs --force    # rebuild all
 *
 * Needs ffmpeg + ffprobe on PATH. Sources are resolved relative to PORTFOLIO_ROOT
 * (default: the folder above site/).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.env.PORTFOLIO_ROOT || path.join(SITE, ".."));
const OUT = path.join(SITE, "public", "media");
const MANIFEST = path.join(SITE, "src", "generated", "media.json");
const MAX_BYTES = 95 * 1024 * 1024;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const data = JSON.parse(fs.readFileSync(path.join(SITE, "works.json"), "utf8"));
const old = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { works: {} };
const manifest = { works: { ...(old.works || {}) }, beforeAfter: old.beforeAfter, showreel: old.showreel };

const rel = (p) => path.relative(path.join(SITE, "public"), p).split(path.sep).join("/");
const mtime = (p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0);
const size = (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0);
const mb = (n) => (n / 1048576).toFixed(1) + " MB";

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}
const ffmpeg = (argv) => run("ffmpeg", ["-v", "error", "-y", "-nostdin", ...argv]);

function probe(file) {
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const v = j.streams.find((s) => s.codec_type === "video");
  return {
    duration: Math.round(parseFloat(j.format.duration) * 10) / 10,
    width: v ? v.width : 0,
    height: v ? v.height : 0,
    audio: j.streams.some((s) => s.codec_type === "audio"),
  };
}

/** true when out exists, is newer than every source and was built with the same key */
function fresh(out, sources, key, keys) {
  if (FORCE || !fs.existsSync(out)) return false;
  const t = mtime(out);
  if (sources.some((s) => mtime(s) > t)) return false;
  return keys[path.basename(out)] === key;
}

function step(label, out, sources, key, keys, build) {
  if (fresh(out, sources, key, keys)) {
    console.log(`  = ${label} (up to date, ${mb(size(out))})`);
    return;
  }
  const t0 = Date.now();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = out.replace(/(\.\w+)$/, ".tmp$1");
  build(tmp);
  fs.renameSync(tmp, out);
  keys[path.basename(out)] = key;
  console.log(`  + ${label} ${mb(size(out))} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (size(out) > MAX_BYTES) throw new Error(`${out} is ${mb(size(out))}, over the 95 MB limit`);
}

const H264 = ["-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart"];
const scaleFor = (vertical, long) => (vertical ? `scale=${long * 9 / 16}:${long}` : `scale=${long * 16 / 9}:${long}`);

function webCopy(src, out, vertical, ss, to) {
  const trim = ss != null ? ["-ss", String(ss), "-to", String(to)] : [];
  ffmpeg([
    ...trim, "-i", src,
    "-vf", `${vertical ? "scale=720:1280" : "scale=1280:720"}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2,setsar=1`,
    ...H264, "-crf", "27", "-maxrate", "1500k", "-bufsize", "3000k",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2", out,
  ]);
}

const want = (id) => only.length === 0 || only.includes(id);

for (const w of data.works) {
  if (!want(w.id)) continue;
  console.log(`\n[${w.id}]`);
  const src = path.join(ROOT, w.source);
  if (!fs.existsSync(src)) {
    console.warn(`  ! source missing: ${src} (skipped)`);
    continue;
  }
  const dir = path.join(OUT, w.id);
  const prev = manifest.works[w.id] || {};
  const keys = { ...(prev.keys || {}) };
  const info = probe(src);
  const vertical = w.format ? w.format === "9:16" : info.height > info.width;
  const ps = Math.min(w.previewStart ?? info.duration * 0.25, Math.max(0, info.duration - 6));

  step("web.mp4", path.join(dir, "web.mp4"), [src], "web-v1", keys, (o) => webCopy(src, o, vertical));

  step("preview.mp4", path.join(dir, "preview.mp4"), [src], `preview-v1-${ps}`, keys, (o) =>
    ffmpeg([
      "-ss", String(ps), "-t", "6", "-i", src, "-an",
      "-vf", `${scaleFor(vertical, vertical ? 640 : 360)},fps=30,setsar=1`,
      ...H264, "-crf", "30", "-maxrate", "1200k", "-bufsize", "2400k", o,
    ]));

  const posterSrc = w.poster ? path.join(ROOT, w.poster) : null;
  const usePoster = posterSrc && fs.existsSync(posterSrc);
  step("poster.jpg", path.join(dir, "poster.jpg"), usePoster ? [posterSrc] : [src], `poster-v1-${usePoster ? w.poster : ps}`, keys, (o) =>
    ffmpeg([
      ...(usePoster ? [] : ["-ss", String(ps)]), "-i", usePoster ? posterSrc : src, "-frames:v", "1",
      "-vf", `${vertical ? "scale=540:960" : "scale=1280:720"}:force_original_aspect_ratio=increase,crop=${vertical ? "540:960" : "1280:720"}`,
      "-q:v", "4", "-update", "1", o,
    ]));

  let breakdown = null;
  const bSrc = w.breakdown ? path.join(ROOT, w.breakdown) : null;
  if (bSrc && fs.existsSync(bSrc)) {
    step("breakdown.jpg", path.join(dir, "breakdown.jpg"), [bSrc], "breakdown-v1", keys, (o) =>
      ffmpeg(["-i", bSrc, "-frames:v", "1", "-vf", "scale='min(1600,iw)':-2", "-q:v", "5", "-update", "1", o]));
    breakdown = `media/${w.id}/breakdown.jpg`;
  }

  let timelineItems = null;
  const xml = w.premiere ? path.join(ROOT, w.premiere) : null;
  if (xml && fs.existsSync(xml)) timelineItems = (fs.readFileSync(xml, "utf8").match(/<clipitem\b/g) || []).length;

  manifest.works[w.id] = {
    duration: info.duration,
    width: info.width,
    height: info.height,
    vertical,
    web: rel(path.join(dir, "web.mp4")),
    preview: rel(path.join(dir, "preview.mp4")),
    poster: rel(path.join(dir, "poster.jpg")),
    breakdown,
    timelineItems,
    bytes: { web: size(path.join(dir, "web.mp4")), preview: size(path.join(dir, "preview.mp4")) },
    keys,
  };
}

// ---- before / after: cut the sequential reel into two equal, synced clips ----
const ba = data.beforeAfter;
if (ba && fs.existsSync(path.join(ROOT, ba.source)) && (only.length === 0 || only.includes("before-after"))) {
  console.log("\n[before/after slider]");
  const src = path.join(ROOT, ba.source);
  const dir = path.join(OUT, "ba-slider");
  const keys = { ...((manifest.beforeAfter && manifest.beforeAfter.keys) || {}) };
  const info = probe(src);
  const vertical = info.height > info.width;
  for (const side of ["before", "after"]) {
    const [a, b] = ba[side];
    step(`${side}.mp4`, path.join(dir, `${side}.mp4`), [src], `ba-v1-${a}-${b}`, keys, (o) => webCopy(src, o, vertical, a, b));
  }
  step("poster.jpg", path.join(dir, "poster.jpg"), [src], `ba-poster-v1-${ba.after[0]}`, keys, (o) =>
    ffmpeg(["-ss", String(ba.after[0] + 2), "-i", src, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "4", "-update", "1", o]));
  manifest.beforeAfter = {
    before: "media/ba-slider/before.mp4",
    after: "media/ba-slider/after.mp4",
    poster: "media/ba-slider/poster.jpg",
    duration: Math.round((ba.after[1] - ba.after[0]) * 10) / 10,
    keys,
  };
}

// ---- showreel: a short highlight from every work, 1280x720, muted ----
{
  console.log("\n[showreel]");
  const clip = (data.showreel && data.showreel.clipSeconds) || 1.8;
  const picks = data.works
    .filter((w) => w.reel !== false && manifest.works[w.id] && fs.existsSync(path.join(SITE, "public", manifest.works[w.id].web)))
    .map((w) => {
      const m = manifest.works[w.id];
      const start = Math.min(w.reelStart ?? (w.previewStart ?? 0) + 1, Math.max(0, m.duration - clip));
      return { id: w.id, file: path.join(SITE, "public", m.web), vertical: m.vertical, start };
    });
  if (picks.length) {
    const out = path.join(OUT, "showreel.mp4");
    const keys = { ...((manifest.showreel && manifest.showreel.keys) || {}) };
    const key = "reel-v1-" + clip + "-" + picks.map((p) => `${p.id}@${p.start}`).join(",");
    step("showreel.mp4", out, picks.map((p) => p.file), key, keys, (o) => {
      const inputs = picks.flatMap((p) => ["-ss", String(p.start), "-t", String(clip), "-i", p.file]);
      const parts = picks.map((p, i) => {
        const tail = `fps=30,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.15,fade=t=out:st=${(clip - 0.15).toFixed(2)}:d=0.15[v${i}]`;
        return p.vertical
          ? `[${i}:v]split[a${i}][b${i}];[a${i}]scale=1280:-2,crop=1280:720,boxblur=20:2,eq=brightness=-0.15[bg${i}];` +
              `[b${i}]scale=-2:720[fg${i}];[bg${i}][fg${i}]overlay=(W-w)/2:0,${tail}`
          : `[${i}:v]scale=1280:720,${tail}`;
      });
      const fc = parts.join(";") + ";" + picks.map((_, i) => `[v${i}]`).join("") + `concat=n=${picks.length}:v=1:a=0[v]`;
      ffmpeg([...inputs, "-filter_complex", fc, "-map", "[v]", "-an", ...H264, "-crf", "30", "-maxrate", "1500k", "-bufsize", "3000k", o]);
    });
    step("showreel.jpg", path.join(OUT, "showreel.jpg"), [out], "reel-poster-v2", keys, (o) =>
      ffmpeg(["-ss", "1.2", "-i", out, "-frames:v", "1", "-q:v", "4", "-update", "1", o]));
    manifest.showreel = { video: "media/showreel.mp4", poster: "media/showreel.jpg", duration: picks.length * clip, keys };
  }
}

// drop manifest entries for works that were removed from works.json
for (const id of Object.keys(manifest.works)) if (!data.works.some((w) => w.id === id)) delete manifest.works[id];

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

// size report
const all = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    fs.statSync(p).isDirectory() ? walk(p) : all.push([p, size(p)]);
  }
})(OUT);
all.sort((a, b) => b[1] - a[1]);
console.log(`\nmedia total ${mb(all.reduce((s, x) => s + x[1], 0))}; largest:`);
for (const [p, s] of all.slice(0, 6)) console.log(`  ${mb(s).padStart(9)}  ${path.relative(SITE, p)}`);
if (all.some(([, s]) => s > MAX_BYTES)) process.exit(1);
