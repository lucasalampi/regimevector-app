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
| `/markets` | Jump links; regime dimensions (tap → the instrument each reads); cross-asset cards with tappable rows and section counts; transmission map with links to both nodes |
| `/asset?group=&sym=` | Drill-down: breadcrumb, instrument header, RV analytic note, chart (Timeline default / Overlay), related instruments and the dimension fed, range statistics, behaviour by regime, co-movement, sectioned instrument list |
| `/research` | Library grouped by programme, with filters |
| `/reader/[id]` | Reader: daily summary, fit-width edition pages, save |
| `/viewer/[id]` | Full-screen edition: zoom, text selection, page counter |
| `/events` | Thematic event feed: theme cards (count, unread, live tracked instrument) as filters; items grouped by day with theme colour, live instrument chips ("Now" on earlier days); Today's edition panel |
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

**Instruments (43)** live in `content/instruments.json`, grouped into sections:

| Group | Sections |
|---|---|
| Rates | Treasury curve (2Y/10Y/30Y, 2s10s, 10s30s, 2s10s30s fly) · Policy (Fed funds, Dec hike odds, 2Y − Fed funds) · Credit (HY/IG/CCC OAS, HY − IG, HYG) · Canada (2Y, 10Y, 2s10s) |
| FX | Dollar · Majors · Differentials (Canada − US 2Y/10Y, Fed − BoC policy) |
| Equities | Indices · Volatility · Market structure (S&P vs 200-day, S&P from 52-week high, Russell 2000/S&P, Nasdaq/Dow) |
| Inflation | Prints · Commodities |

**Derived instruments** are built edition by edition from archive fields. An `expr` sets the formula: spread, fly, pctvs (percent versus) or rel (relative, rebased to 100). They are marked "RV" in the app.

Each row also states how it moves:
- yields in **bp**;
- probabilities and percent levels in **pp**;
- spreads already quoted in bp in **bp**;
- prices in **%**.

A value the latest edition did not re-observe shows **"as of <date>"** instead of a change. Canada fields last arrived on 23 Nov.

**Chart interaction:**
- **Timeline** (default): the plot stays clean and a regime ribbon runs underneath. **Overlay**: the plot itself is tinted by regime. Switch on the chart, or set the default in Settings.
- **On phones:** a sideways drag, or a 180 ms press-and-hold, starts reading values with a crosshair, an axis value tag, the date and a light haptic tick. A vertical swipe still scrolls the page.
- **On the web:** hover to read.

**To publish a new edition:**
1. Drop the new archive in `../project/uploads/`, or pass its path to the script.
2. Add that date's drivers to `content/editions.json`.
3. Add new PDFs to `assets/briefs/` and list them in `content/research.json`.
4. Run `npm run build:data`.

The script fails loudly if a listed brief file is missing or if content refers to an unknown document id.

## Events and the mid-day note

`content/events.json` holds client **themes** (id, name, colour, tracked instrument; `internal` themes are hidden from Client) and **alerts** (`theme`, ISO `date`, `type`, `links` to instruments).

Research entries flagged `midday: true` are mid-day orientation notes, and they are offered **only on their own publication day**. On that day, Events shows **Open mid-day orientation note** and Today's Latest research lists the note. On any other day both leave it out. Events then says that no mid-day note was issued and opens the day's brief instead (operating-state brief for Internal, client brief otherwise), with a link to the event-contingent archive in Research (`/research?filter=Events`).

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
