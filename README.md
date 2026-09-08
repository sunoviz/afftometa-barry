# Barry Affiliate Tracker

Local implementation of the authenticated dashboard at https://afftometa.online/, captured on 8 September 2026. The active entry point uses the reference HTML, CSS and browser calculations. The earlier React implementation remains in `src/` for comparison.

## Run

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Login uses the reference's email whitelist flow. The default allowed email is `barry@gmail.com`.

For a production build:

```sh
npm run build
npm start
```

The production server listens on `http://127.0.0.1:3000`. The app requires its Node server for login and history; publishing `dist/` alone is insufficient. `npm run preview` also includes the local API.

## Configuration and storage

| Variable | Default | Purpose |
| --- | --- | --- |
| `ALLOWED_EMAILS` | `barry@gmail.com` | Comma-separated server login whitelist |
| `DATABASE_PATH` | `.data/history.sqlite` | Persistent snapshots and sessions |
| `PORT` | `3000` | Production server port |
| `HOST` | `127.0.0.1` | Production server bind address |
| `COOKIE_SECURE` | `false` | Set true when serving over HTTPS |

Snapshots are isolated by email and identical payloads are deduplicated. History opens an individual snapshot, without merging overlapping uploads. Storage is independent of the reference website; remote history is not copied. The former React app's IndexedDB data remains in the browser but is not imported into the new server.

The frontend mirrors the reference's email-only access model. Local vendor files keep CSV parsing, charts and Excel export independent of external CDNs.

## Source layout

- `index.html`: reference dashboard markup.
- `public/reference.css`, `public/reference.js`: reference styles and browser behavior, including workspace/account filters, recommendations, detail tables, mobile layout and five-sheet Excel export.
- `public/vendor/`: PapaParse 5.4.1, Chart.js 4.4.1, SheetJS 0.18.5; original notices retained.
- `server/`: login, sessions, SQLite history API, production serving and API tests.
- `docs/reference.json`: capture provenance and original HTML checksum.
- `scripts/check-browser.mjs`: browser integration and optional visual reference comparison.

## Verification

```sh
npm run build
npm run lint
npm run test -- --run
npm run test:server
npm run test:browser
```

Browser tests use the three original CSVs in `file csv/`. Set `CHROMIUM_PATH` to a local Chromium executable if the default workspace browser is unavailable. Set `REFERENCE_HTML` to a captured reference HTML file to compare dashboard values, tab text and screenshots. Without it, integration checks still run and output reports `referenceCompared: false`.

Screenshots and the workbook are written to the ignored `artifacts/` directory. Tests use a temporary SQLite database and never upload data to the reference service.

## Production

Deployed at https://afftometa-barry.vercel.app using the linked Vercel project. The Vercel API uses private Blob storage via `BLOB_READ_WRITE_TOKEN`; local runs use SQLite. Visible branding is Barry and donation prompts have been removed. Existing internal storage keys are retained for history compatibility.
