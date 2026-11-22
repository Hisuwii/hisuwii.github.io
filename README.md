# sui. video editor portfolio

Vite + vanilla TypeScript, deployed as a static site on GitHub Pages. All videos are listed in
`works.json`; the media script turns the finished exports into small web files in `public/media/`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
npm run preview    # serves dist/
```

## Deploy (GitHub Pages)

1. Create an empty repository on github.com (any name, e.g. `portfolio`).
2. From this `site` folder:
   ```bash
   git init -b main
   git add .
   git commit -m "Portfolio site"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. On GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
   The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
   The site appears at `https://<you>.github.io/<repo>/` (the build uses a relative base, so any repo name works).

Media files are committed normally (no Git LFS). The media script fails if any file is over 95 MB
(GitHub rejects files over 100 MB).

## Before publishing: fill in `src/config.ts`

- `EMAIL` (placeholder `you@example.com`), used by the "Send this brief" and "Email me" buttons
- `ONLINEJOBS_URL`, `UPWORK_URL` (buttons stay hidden while empty)
- `SITE_URL`: the final Pages URL, so link previews on social media get an absolute image URL
- `PRICE_TYPES` / `PRICE_EXTRAS`: the quote estimator prices are placeholders, set your own rates

`public/og.jpg` is the social preview image (1280x720); replace it if you like.

## Add a new video

1. Add one entry to `works.json` (copy an existing one). Paths are relative to the Portfolio folder
   (the parent of `site/`):

   ```json
   {
     "id": "real-estate-tour",
     "title": "Lakeside Villa Listing Tour",
     "label": "Real estate",
     "format": "16:9",
     "tags": ["Long-form", "Real estate"],
     "desc": "One-sentence summary shown on the card and in the player.",
     "points": ["What you did #1", "What you did #2"],
     "styles": ["Speed ramps", "Colour grade", "Lower thirds"],
     "source": "real-estate-tour/exports/real_estate_tour_upload.mp4",
     "poster": "packs/real_estate_tour/thumbnail.jpg",
     "breakdown": "real-estate-tour/exports/contact_sheet.png",
     "premiere": "real-estate-tour/exports/real_estate_tour_premiere.xml",
     "previewStart": 12,
     "youtube": ""
   }
   ```

   - `format`: `"16:9"` goes in the main grid, `"9:16"` in the Shorts row.
   - `tags` become the filter chips automatically (e.g. add `"Ads"` for an ad).
   - `previewStart`: second where the 6 s hover loop starts; `reelStart` (optional) picks the
     1.8 s hero showreel highlight, `"reel": false` leaves the work out of the showreel.
   - `poster`, `breakdown`, `premiere` are optional (no poster = a frame at `previewStart`).
   - `youtube`: once uploaded, put the video id here and the player embeds YouTube instead of the local file.
2. Run the media script (needs ffmpeg + ffprobe), then build and push:
   ```bash
   npm run media                 # only new/changed files are encoded
   npm run media -- <id>         # just one work (the showreel is rebuilt too)
   npm run media -- --force      # re-encode everything
   npm run build
   git add . && git commit -m "Add <title>" && git push
   ```

The script writes `public/media/<id>/{web.mp4, preview.mp4, poster.jpg, breakdown.jpg}`,
`public/media/showreel.mp4`, the before/after slider clips in `public/media/ba-slider/`, and
`src/generated/media.json` (durations, timeline item counts) that the site reads for the stats.

The Before/After slider cuts `beforeAfter.source` in `works.json` into two equal clips
(`before` and `after` are `[start, end]` seconds).
