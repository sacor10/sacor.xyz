# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Live Stocks (`/stocks`)

The `/stocks` page renders a candlestick chart with hourly OHLC data plus a live-ish price ticker.

- **Historical bars** come from Yahoo Finance's public chart endpoint (no API key needed). It's an undocumented endpoint, so it may break if Yahoo changes the response shape.
- **Live quotes** come from [Finnhub](https://finnhub.io/) and require a free API key.

### Running locally

1. Get a free API key at https://finnhub.io/register (Dashboard → API Key).
2. Copy the example env file and paste your key:
   ```sh
   cp .env.example .env
   # edit .env and set FINNHUB_API_KEY=...
   ```
3. Install [Netlify CLI](https://docs.netlify.com/cli/get-started/) if you don't have it, then run the dev server (it loads `.env` and serves the functions alongside Vite):
   ```sh
   npx netlify dev
   ```
4. Visit `http://localhost:8888/stocks`.

`vite dev` alone won't work for the stocks page because it doesn't run the Netlify Functions that proxy Finnhub. The Finnhub key is read server-side only and is never sent to the browser.

### Endpoints

- `GET /.netlify/functions/stocks-history?symbol=AAPL` &mdash; ~1 month of hourly OHLC bars (5-minute in-memory cache).
- `GET /.netlify/functions/stocks-quote?symbol=AAPL` &mdash; current price, change, change %, timestamp.
