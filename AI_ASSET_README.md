# AI Asset Generation List

This list covers art and icon assets in this repo that are good candidates for AI generation and are intended to be `512x512` or smaller. The site has a loud late-90s/GeoCities style, so generated assets should feel like small web badges, pixel art, sticker icons, or low-resolution novelty graphics rather than polished modern illustration.

## Assets To Generate

| Asset path | Target size | Used by | Description / generation brief |
| --- | ---: | --- | --- |
| `public/favicon.svg` | `48x46` | Browser favicon | Tiny lightning-bolt site mark for Sacor.xyz. Generate a crisp, high-contrast retro web icon with an electric purple bolt, cyan highlights, and transparent or simple dark background. It must stay readable at favicon sizes. |
| `public/placeholders/bg.svg` | `64x64` | Global tiled page background in `src/App.css` | Seamless repeating pixel-art space tile. Dark purple base with tiny yellow stars, cyan/magenta sparkle pixels, and early-web charm. Should tile cleanly without visible edges. |
| `public/placeholders/globe.svg` | `64x64` | Header left/right globe images in `src/Layout.jsx` | Small animated-style spinning globe icon. Blue ocean, bright green land shapes, yellow outline/rim, white latitude/longitude hints, 90s web "under construction" energy. If output is static, make it look like a frame from a spinning GIF. |
| `public/placeholders/construction.svg` | `90x90` | Left navigation sidebar in `src/Layout.jsx` | Retro "under construction" square badge. Yellow/black hazard stripes, chunky pixels, tiny worker helmet or construction light motif, black outlines, hot magenta/cyan accent border. |
| `public/placeholders/me.svg` | `100x100` | About Sacor box in `src/pages/HomePage.jsx` | Pixel-art portrait/avatar for Sacor. Square 100x100 style, Comic Sans-era personal homepage feel, cyan background, magenta shirt/banner, bold black outlines, friendly expression, readable silhouette at small size. |
| `public/placeholders/netscape.svg` | `88x31` | Home sidebar "Netscape Now" badge in `src/pages/HomePage.jsx` | Tiny 88x31 web button inspired by old "best viewed with" badges. Avoid using official logos exactly; make a parody browser badge with blue/gray blocks, pixel typography, and orange swoosh energy. |
| `public/placeholders/thumb1.svg` | `80x80` | YtMp4 blog/download thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Blog thumbnail for a YouTube-to-MP4 downloader EXE. Retro desktop monitor with a play triangle, "YT to MP4" feeling, bright red/white/black/yellow palette, tiny shareware/freeware badge energy. |
| `public/placeholders/thumb2.svg` | `80x80` | Salt Lake City LAN party blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Blog thumbnail for "Salt Lake City Is Basically a Giant LAN Party in the Mountains." Pixel-art sunset over purple Utah mountains, tiny computer/network/cable detail if possible, yellow/cyan/magenta accents. |
| `public/placeholders/thumb3.svg` | `80x80` | 90s snacks blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Blog thumbnail for ranking 90s snacks. Bright snack-box illustration with cookie/cracker shapes, bold "90s snacks" vibe, saturated orange/yellow/red palette, chunky black outlines. |
| `public/placeholders/thumb4.svg` | `80x80` | "Somebody needs to stop it now!!!" blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Blog thumbnail with urgent warning-sign comedy. Yellow hazard triangle, exclamation mark, black background, red alert accents, tiny sparkle pixels. Make it funny-alarming rather than genuinely threatening. |

## Not Included

These visual elements are `512x512` or smaller but do not appear to need AI generation:

- `public/icons.svg`: brand/social/documentation icon symbols; these should stay as vector UI/brand glyphs.
- `public/placeholders/counter.svg` and the inline counter SVG in `src/components/HitCounter.jsx`: functional counter UI, better kept deterministic.
- Inline fallback feed thumbnail SVG in `src/pages/BlogIndexPage.jsx`: generated from feed initials at runtime.
- `src/assets/react.svg`, `src/assets/vite.svg`, and `src/assets/hero.png`: unused starter/template assets in the current app surface.
