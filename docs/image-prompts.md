# Image prompts (Step 4 of the five-step prompt)

Step 4 is written for a marketing page with a hero, a gallery and a portrait. Mizo Money has none of those: its pages
show your own data, and a photograph inside a working page would be decoration in the way. So the slots below are the
only places an image belongs. There is no hero video and no map.

The README screenshots are the "real photos" of this product. They stay real screens of the demo household
(`npm run demo`) and are never generated.

## Slots

| # | Slot | File | Size | Where it shows |
|---|---|---|---|---|
| 1 | Logo study, round seal | `docs/art/logo-a.png` | 1:1, 1024×1024 | Reference only, redrawn by hand as `web/public/seal.svg` |
| 2 | Logo study, square seal | `docs/art/logo-b.png` | 1:1, 1024×1024 | Reference only |
| 3 | Logo study, ribbon M | `docs/art/logo-c.png` | 1:1, 1024×1024 | Reference only |
| 4 | Repository banner | `docs/art/banner.jpg` | 2:1, 1280×640 | Top of README and GitHub's social preview |
| 5 | First-run welcome | `web/public/art/welcome.webp` | 4:3, 1200×900 | The first-run screen, beside the Plaid keys form |
| 6 | Empty: no banks yet | `web/public/art/empty-banks.webp` | 1:1, 640×640 | Accounts & net worth with nothing connected |
| 7 | Empty: no budget yet | `web/public/art/empty-budget.webp` | 1:1, 640×640 | Budget before any amount is set |
| 8 | Empty: no goals yet | `web/public/art/empty-goals.webp` | 1:1, 640×640 | Plan with no goals |
| 9 | Empty: no trips yet | `web/public/art/empty-trips.webp` | 1:1, 640×640 | Trips with none found |

The app icons (`seal-192.png`, `seal-512.png`, `seal-maskable.png`) are exported from the final `seal.svg`, not
generated.

## Two shared style lines

Illustrations (slots 5 to 9), appended to each:

> Hand-drawn stationery illustration in a single deep indigo ink line of even weight, with one flat pale indigo wash
> for shadow, on warm off-white paper with a faint dot grid; generous empty margins, no gradients, no outlines in
> black, no red, no yellow, no people; calm and exact, like a diagram in the front of a Japanese planner.

Photograph and logo studies (slots 1 to 4), appended to each:

> Soft overcast daylight from a window on the left, low contrast, matte finish; a colour world of deep navy-indigo
> bookcloth, warm off-white paper and one small vermillion-red ink seal, nothing else saturated; quiet, orderly,
> understated.

Every prompt also ends with: **No text, no letters other than the one named, no watermark, no logos, no hands, no
faces.**

## The prompts

### 1. Logo study, round seal — `docs/art/logo-a.png`, 1:1

A single round hanko seal impression stamped in vermillion-red ink in the centre of a sheet of warm off-white paper,
the seal carved with one bold capital letter M in the paper colour, a thin inner ring just inside the edge, the ink
slightly uneven at the rim as a real stamp leaves it, seen straight on from above, filling 60% of the frame, macro
photograph with a 100mm lens feel and shallow paper texture. [photograph style line]. No text other than the single
letter M, no watermark, no other logos, no hands.

### 2. Logo study, square seal — `docs/art/logo-b.png`, 1:1

A single square hanko seal impression with softly rounded corners, stamped in vermillion-red ink in the centre of warm
off-white paper, carved with one capital letter M whose two outer strokes run the full height of the square like the
uprights of a ledger column, paper colour showing through the letter, ink a little heavier on one side, seen straight
on from above, filling 55% of the frame, macro photograph with a 100mm lens feel. [photograph style line]. No text
other than the single letter M, no watermark, no other logos, no hands.

### 3. Logo study, ribbon M — `docs/art/logo-c.png`, 1:1

A flat graphic mark on warm off-white paper: a capital letter M formed by one continuous folded ribbon bookmark in
vermillion-red, as if a planner's ribbon had been laid down in three folds, sitting inside a thin round ring of the
same colour; flat vector style, two tones only (vermillion and paper), no shading, no texture, centred, filling 60%
of the frame. No text other than the single letter M, no watermark, no other logos.

### 4. Repository banner — `docs/art/banner.jpg`, 2:1 (1280×640)

A closed cloth-bound planner in deep navy-indigo lying square on a pale oak desk, seen from directly above, its woven
cover texture and a line of stitching down the spine edge clearly visible, a small round vermillion-red wax-like ink
seal pressed on the lower corner of the cover, one dark fountain pen lying parallel to the planner's right edge, the
left two thirds of the frame empty warm off-white desk blotter paper with a faint dot grid; planner and pen sit in the
right third; photograph with a 50mm lens feel, everything in focus. [photograph style line]. No text, no letters, no
watermark, no logos, no hands.

### 5. First-run welcome — `web/public/art/welcome.webp`, 4:3 (1200×900)

An open planner lying flat, drawn from above at a slight angle: the left page ruled with empty lines, the right page
a blank month grid of small squares, a ribbon bookmark trailing off the bottom edge, a capped pen resting in the
gutter, and a small house key lying on the left page to suggest that everything stays at home; the planner sits in
the lower right two thirds, the upper left is empty paper. [illustration style line]. No text, no numbers, no
watermark, no logos, no hands.

### 6. Empty: no banks yet — `web/public/art/empty-banks.webp`, 1:1

A small classical bank building front with four columns and a plain pediment, drawn straight on, standing on a single
ruled line, with a short dashed line running from its door toward the right edge of the frame, ending in a small open
circle, as if waiting to be connected; centred, the building no more than half the frame's height. [illustration
style line]. No text, no numbers, no watermark, no logos.

### 7. Empty: no budget yet — `web/public/art/empty-budget.webp`, 1:1

Five empty paper envelopes standing upright in a row inside a shallow open box, each a slightly different height,
flaps open, drawn from a low three-quarter angle, the box sitting on a single ruled line; centred, with empty paper
above. [illustration style line]. No text, no numbers, no labels on the envelopes, no watermark, no logos.

### 8. Empty: no goals yet — `web/public/art/empty-goals.webp`, 1:1

A glass jar with a cork lid, empty, standing on a single ruled line, with three short horizontal tick marks drawn up
its side like a measuring scale and a small flag pinned at the top mark; drawn straight on, centred, the jar about
half the frame's height. [illustration style line]. No text, no numbers, no coins, no watermark, no logos.

### 9. Empty: no trips yet — `web/public/art/empty-trips.webp`, 1:1

A closed suitcase standing upright on a single ruled line with a blank luggage tag hanging from its handle, and
behind it a dashed curved line rising from the lower left to a small open circle at the upper right, like a route not
yet taken; drawn straight on, centred. [illustration style line]. No text, no numbers, no stickers, no watermark, no
logos.

## After the images exist: wiring brief

For a subagent, once the files are saved under the names above. Sonnet, medium effort.

- **Logo:** the owner picks one study. Redraw it by hand as `web/public/seal.svg` and in `Seal` (`web/src/ui.jsx`):
  two colours, `var(--seal)` and `var(--seal-ink)`, readable at 16px. Re-export `seal-192.png`, `seal-512.png` and
  `seal-maskable.png` from the SVG. Never ship the generated raster as the logo.
- **Empty states:** `EmptyState` in `web/src/ui.jsx` gets an optional `art` prop (a file name). When set, it shows the
  image at 120px in place of the icon well, with `alt=""`, `loading="lazy"`, `width` and `height` set. Dark mode: the
  images are indigo line on pale paper, so in dark themes show them on a paper-coloured rounded tile, or generate a
  second set; do not invert them with a filter.
- **Welcome:** `FirstRun` in `web/src/PlaidSetup.jsx` shows `welcome.webp` beside the form at 1100px wide and up,
  hidden below that.
- **Banner:** add it at the top of `README.md` above the dashboard screenshot; the owner uploads the same file as the
  repository's social preview in GitHub's settings.
- **Size and weight:** each empty-state image under 40 KB, the welcome under 120 KB (convert with real compression,
  not a renamed file). `scripts/package.mjs` must include `web/public/art/` in the download: check that it does.
- **Checks:** `npm run check:ui` passes in light and dark; the offline page (`web/public/sw.js`) gets no image, since
  nothing is cached and it would not load while the server is down.
