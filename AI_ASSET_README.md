# AI Asset Generation List

This list covers art and icon assets in this repo that are good candidates for AI generation and are intended to be `512x512` or smaller. The site has a loud late-90s/GeoCities style, so generated assets should feel like small web badges, pixel art, sticker icons, or low-resolution novelty graphics rather than polished modern illustration.

## Generated Assets

These v2 assets supersede the first generated pass. The v1 PNGs are kept in `public/generated-assets/` for comparison/history, but the site now references the v2 files.

| Generated asset path | Source size | Display size | Used by | Description / generation brief |
| --- | ---: | --- | --- | --- |
| `public/generated-assets/favicon-v2.png` | `512x512` | favicon | Browser favicon | Cleaner lightning-bolt favicon: large centered yellow/purple bolt on a high-contrast retro background. |
| `public/generated-assets/bg-tile-v2.png` | `512x512` | tiled background | Global tiled page background in `src/App.css` | Less grid-like starfield texture with dark purple base and scattered neon pixels. |
| `public/generated-assets/globe-v2.png` | `512x512` | `64x64` | Header left/right globe images in `src/Layout.jsx` | Clear single globe with green continents, grid lines, and a dark retro backdrop. |
| `public/generated-assets/construction-v2.png` | `512x512` | `90x90` | Left navigation sidebar in `src/Layout.jsx` | Clear construction worker/sign silhouette with yellow-black hazard striping. |
| `public/generated-assets/avatar-v2.png` | `512x512` | `100x100` | About Sacor box in `src/pages/HomePage.jsx` | Pixel-art personal homepage avatar with sunglasses and neon 90s color blocks. |
| `public/generated-assets/browser-badge-v2.png` | `512x192` | `88x31` | Home sidebar browser badge in `src/pages/HomePage.jsx` | Wide parody old-browser button source with bevels, neon noise, and no intentional brand logo. |
| `public/generated-assets/thumb-ytmp4-v2.png` | `512x512` | `80x80` | YtMp4 blog/download thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Retro monitor/file thumbnail for the YouTube-to-MP4 downloader post. |
| `public/generated-assets/thumb-slc-lan-v2.png` | `512x512` | `80x80` | Salt Lake City LAN party blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Monitor-and-mountains thumbnail for the Salt Lake City LAN party post. |
| `public/generated-assets/thumb-90s-snacks-v2.png` | `512x512` | `80x80` | 90s snacks blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | More snack-like 90s thumbnail with bag/food shapes and chunky pixel colors. |
| `public/generated-assets/thumb-stop-warning-v2.png` | `512x512` | `80x80` | "Somebody needs to stop it now!!!" blog thumbnail in `src/data/posts.jsx` and `src/pages/BlogPostPage.jsx` | Cleaner warning-sign thumbnail with centered triangle and exclamation mark. |

## Not Included

These visual elements are `512x512` or smaller but do not appear to need AI generation:

- `public/icons.svg`: brand/social/documentation icon symbols; these should stay as vector UI/brand glyphs.
- `public/placeholders/counter.svg` and the inline counter SVG in `src/components/HitCounter.jsx`: functional counter UI, better kept deterministic.
- Inline fallback feed thumbnail SVG in `src/pages/BlogIndexPage.jsx`: generated from feed initials at runtime.
- `src/assets/react.svg`, `src/assets/vite.svg`, and `src/assets/hero.png`: unused starter/template assets in the current app surface.
