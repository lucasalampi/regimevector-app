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
| `/asset?group=&sym=` | Drill-down chart over the whole archive with regime shading, 1M/3M/All, watch stars |
| `/research` | Library grouped by programme, with filters |
| `/reader/[id]` | Reader: daily summary, full edition (PDF pages or interactive special), zoom, save |
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

**To publish a new edition:**
1. Drop the new archive in `../project/uploads/`, or pass its path to the script.
2. Add that date's drivers to `content/editions.json`.
3. Add new PDFs to `assets/briefs/` and list them in `content/research.json`.
4. Run `npm run build:data`.

The script fails loudly if a listed brief file is missing or if content refers to an unknown document id.

## Reader

PDFs are bundled with the app and rendered page by page with **pdf.js 3.11.174**, the same build the prototype used. It is vendored into `assets/pdfjs`, so the reader **works offline**; the prototype loaded it from a CDN. Native renders through `react-native-webview`, sized to its content inside the screen's scroll; web uses a `srcdoc` iframe. The E4 and E5 specials run as interactive pages, sandboxed to scripts only on web. On native, links in them open in the system browser.

## Roles

**Internal** adds:
- Tenure, weakest boundary and the HY status line on the regime card.
- Red, amber and green dimension tints with boundary distances.
- Internal briefs, the positioning sidecar and the NVDA draft.
- Held and engine-log events.

Deep links to internal content redirect when the role is **Client**.

## Persistence

`zustand` with AsyncStorage (localStorage on web) keeps the session, role, watchlist, saved editions, read events, notification toggles, reader zoom and chart display.

## Not yet real

- **Auth:** mocked, in `src/store.ts` `signIn`.
- **Notifications:** the toggles are stored but nothing sends a notification yet.
- **Positioning:** illustrative data.
- **Updates:** data is bundled at build time; a runtime edition feed would replace `src/data/index.ts`'s imports.
