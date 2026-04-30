# AI Asset Generation List

This list covers art and icon assets in this repo that are good candidates for AI generation and are intended to be `512x512` or smaller. The site has a loud late-90s/GeoCities style, so generated assets should feel like small web badges, pixel art, sticker icons, or low-resolution novelty graphics rather than polished modern illustration.

## Generated Assets

| Generated asset path | Source size | Display size | Used by | Description / generation brief |
| --- | ---: | --- | --- | --- |
| `public/generated-assets/favicon.png` | `512x512` | favicon | Browser favicon | Tiny lightning-bolt site mark for Sacor.xyz. Crisp, high-contrast retro web icon with an electric purple bolt and cyan highlights. |
| `public/generated-assets/bg-tile.png` | `512x512` | tiled background | Global tiled page background in `src/App.css` | Seamless-feeling pixel-art space tile. Dark purple base with yellow stars and cyan/magenta sparkle pixels. |
| `public/generated-assets/globe.png` | `512x512` | `64x64` | Header left/right globe images in `src/Layout.jsx` | Static frame of a 1990s-style spinning globe icon with bright land/ocean colors and grid lines. |
| `public/generated-assets/construction.png` | `512x512` | `90x90` | Left navigation sidebar in `src/Layout.jsx` | Retro under-construction badge with hazard colors, chunky pixels, black outlines, and neon accents. |
| `public/generated-assets/avatar.png` | `512x512` | `100x100` | About Sacor box in `src/pages/HomePage.jsx` | Pixel-art personal homepage avatar with cyan/magenta 90s color energy. |
| `public/generated-assets/browser-badge.png` | `512x180` | `88x31` | Home sidebar browser badge in `src/pages/HomePage.jsx` | Parody old-browser web button with blue/gray blocks and orange/retro accents. |
| `public/generated-assets/thumb-ytmp4.png` | `512x512` | `80x80` | YtMp4 blog/download thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Blog thumbnail for a YouTube-to-MP4 downloader EXE. Retro desktop monitor/shareware vibe. |
| `public/generated-assets/thumb-slc-lan.png` | `512x512` | `80x80` | Salt Lake City LAN party blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Blog thumbnail for "Salt Lake City Is Basically a Giant LAN Party in the Mountains." |
| `public/generated-assets/thumb-90s-snacks.png` | `512x512` | `80x80` | 90s snacks blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Bright 1990s snack-box thumbnail with saturated colors and chunky outlines. |
| `public/generated-assets/thumb-stop-warning.png` | `512x512` | `80x80` | "Somebody needs to stop it now!!!" blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Funny warning-sign thumbnail with hazard triangle, red alert accents, and retro web energy. |

## Not Included

These visual elements are `512x512` or smaller but do not appear to need AI generation:

- `public/icons.svg`: brand/social/documentation icon symbols; these should stay as vector UI/brand glyphs.
- `public/placeholders/counter.svg` and the inline counter SVG in `src/components/HitCounter.jsx`: functional counter UI, better kept deterministic.
- Inline fallback feed thumbnail SVG in `src/pages/BlogIndexPage.jsx`: generated from feed initials at runtime.
- `src/assets/react.svg`, `src/assets/vite.svg`, and `src/assets/hero.png`: unused starter/template assets in the current app surface.
