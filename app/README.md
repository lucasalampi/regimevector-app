# RegimeVector Mobile

Expo (React Native + TypeScript) build of the **RegimeVector Mobile v2** design from `../project/RegimeVector Mobile v2.dc.html`: the cross-asset regime platform for iOS, Android and web, in the house navy and gold.

## Run

```bash
npm install
npm run build:data      # archive + content → src/data (also vendors pdf.js)
npx expo start          # i / a / w for iOS, Android, web
npm run typecheck
npm run export:web      # static web build in dist/
```

The app needs no backend. Sign-in is mocked: any valid email and a password of 6+ characters works. Pick **Client** or **Internal** at sign-in, or switch later in Settings.

## Screens

| Route | Screen |
| --- | --- |
| `/login` | Sign in with access role |
| `/` | Today: regime card, macro or strategist view, scenario weights, drivers, latest research |
| `/markets` | Regime dimensions, cross-asset close, transmission map |
| `/asset?group=&sym=` | Drill-down: instrument header and current regime, scrubbable chart with axes and regime context, range statistics, behaviour by regime, co-movement with the transmission nodes, group list with sparklines |
| `/research` | Library grouped by programme, with filters |
| `/reader/[id]` | Reader: daily summary, fit-width edition pages, save |
| `/viewer/[id]` | Full-screen edition: zoom, text selection, page counter |
| `/events` | Event feed with unread state and the mid-day note |
| `/more`, `/watchlist`, `/positioning`, `/names`, `/name/[tk]`, `/search`, `/settings` | Secondary screens |

The navy masthead and the five-tab bar stay on every screen, as in the design. Tapping a tab clears any pushed screens.

## Data flow

```
../project/uploads/macro_archive_*.json ─┐
content/instruments.json   (catalogue)  ─┤
content/editions.json      (drivers)    ─┼─ scripts/build-data.mjs ─→ src/data/edition.generated.json
content/research.json      (library)    ─┤                           src/data/briefAssets.generated.ts
content/events.json, positioning.json   ─┘                           assets/pdfjs/*.txt
```

- **From the archive:** levels and daily changes, all 130 editions of history for every chart, regime runs for the shading, the seven dimensions with boundary distances, scenario weights, both view texts, tenure and the weakest boundary. The transmission matrix is computed from the last 60 editions of daily changes: yield and OAS changes are differences, the rest are percent changes.
- **Editorial content:** `content/` holds what the archive does not: driver lists, the event feed, the research catalogue, issuers and positioning. Positioning is still **illustrative** and is labelled so in the app.

**Coverage is never invented.** Values carry forward across a missing edition, but an instrument's history starts at its first observation. GBP/USD, for example, starts on 2 Sep 2026 (edition 72), and the chart marks the earlier stretch "Not in archive". Monthly releases (CPI, core CPI, core PCE, PPI, ISM prices) are tagged `freq: monthly` in `content/instruments.json`: they draw as steps and skip per-session statistics.

**To publish a new edition:**
1. Drop the new archive in `../project/uploads/`, or pass its path to the script.
2. Add that date's drivers to `content/editions.json`.
3. Add new PDFs to `assets/briefs/` and list them in `content/research.json`.
4. Run `npm run build:data`.

The script fails loudly if a listed brief file is missing or if content refers to an unknown document id.

## Reader

Editions are bundled with the app and rendered with **pdf.js 3.11.174**, vendored in `assets/pdfjs` so the reader works offline.

- **Reader (`/reader/[id]`)** shows the edition's pages at the phone's width, drawn at the screen's full resolution. Page count and page shapes are measured at build time by `build-data`, so the pages take their final size before they draw and nothing jumps while scrolling. Tapping a page, or **Read full screen**, opens the viewer at that page.
- **Viewer (`/viewer/[id]?page=n`)** is full screen with the tab bar hidden. The document scrolls on its own and draws pages as they come into view. **−/+** step through Fit, 125%, 150%, 200%, 250%, 300% and 400%, and each step redraws the pages sharp rather than stretching them; wider pages pan sideways. Text is selectable, and the bar shows "Page X of N" as you scroll. On phones, pinch-to-zoom also works.
- **Interactive specials (E4, E5)** are full-page layouts. The Reader shows a preview with **Open interactive edition**, and they run full screen in the viewer: sandboxed to scripts only on web; on native, links open in the system browser.
- **Research list rows** show each edition's page count, or "Interactive".

## Roles

**Internal** adds:
- Tenure, weakest boundary and the HY status line on the regime card.
- Red, amber and green dimension tints with boundary distances.
- Internal briefs, the positioning sidecar and the NVDA draft.
- Held and engine-log events.

Deep links to internal content redirect when the role is **Client**.

## Persistence

`zustand` with AsyncStorage (localStorage on web) keeps the session, role, watchlist, saved editions, read events, notification toggles and chart display.

## Not yet real

- **Auth:** mocked, in `src/store.ts` `signIn`.
- **Notifications:** the toggles are stored but nothing sends a notification yet.
- **Positioning:** illustrative data.
- **Updates:** data is bundled at build time; a runtime edition feed would replace `src/data/index.ts`'s imports.
