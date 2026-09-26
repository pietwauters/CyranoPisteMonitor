# CLAUDE.md

Guidance for working in this repo, beyond what README.md already covers (install/run/boot setup).

## Architecture

- `server.js` — Express server serving `public/`, plus small REST endpoints (fencer photo upload, etc.).
- `public/js/opp2.js` — OPP2 protocol library: MQTT topic parsing (`openpiste/{piste_id}/{publisher}/{message_type}`,
  publisher ∈ apparatus/software/remote), JSON deserialization per message type, and a `Dispatcher` that routes
  parsed messages to registered callbacks and updates a `SystemState` snapshot.
- `public/main.js` — the piste display (`index.html`). Connects via Paho MQTT over WebSocket, subscribes to
  `openpiste/{piste}/apparatus/#`, and drives both the v1 (default) and v2 (`?layout=v2`) boards from the same
  OPP2 message handlers.
- `public/style-v2.css` / the `.v2-board` markup in `index.html` — an alternative single-strip layout, toggled via
  `?layout=v2` (see `body.layout-v2` rules in `style.css`). This was ported from an approved Claude Artifact mockup;
  class names, `clip-path` polygon percentages, and the `--stroke` custom property are coupled to each other by
  design — don't rename/restructure them casually.
- `public/overview.html` — multi-piste grid. Auto-discovers online pistes via `openpiste/+/apparatus/connection`,
  but note it does **not** go through `OPP2.Deserializer` — it only uses `OPP2.TopicParser.parse()` for the topic
  and then hand-parses the JSON payload itself (`data.online`). `main.js`, by contrast, routes everything through
  `OPP2.Dispatcher.dispatch()` → `OPP2.Deserializer.deserialize()`. These two paths can diverge in what payload
  shapes they accept — keep this in mind if a message type behaves correctly on one page but not the other.

## Theming, day/night and i18n

Three independent user choices — **look** (`theme`), **mode** (`dark`/`light`/`auto`) and **language**
(`en`/`fr`/`es`) — are resolved by `public/js/prefs.js` and exposed as `data-theme`, `data-mode` and `lang` on
`<html>` (set in `<head>` before first paint). Precedence: choice made on the page > URL (`?theme=&mode=&lang=`,
never saved) > `localStorage` > default (classic / dark / browser language). `?layout=v2` is a separate axis.

- **Colours are tokens, never literals.** `public/css/signal.css` holds the fixed signal colours (fencer sides,
  lamps, cards, frames, UW2F) — deliberately not themable. `public/themes/<name>/theme.css` holds chrome only
  (backgrounds, text, accents, fonts); the base `:root` block is the dark palette and
  `:root[data-theme="…"][data-mode="light"]` overrides it. `style.css`/`style-v2.css` must only use `var(--…)`.
- **Adding a look:** copy `themes/classic/`, change token values, register it in `THEMES` in `prefs.js` (and a
  display name in `THEME_NAME` in `prefs-ui.js`). The look dropdown appears once there are two.
- **`fie` theme** (`themes/fie/`): palette/type sampled from fie.org — night is their default, day is a white page.
  Font (League Spartan, OFL) and logo SVGs are self-hosted in the theme folder, so the app has no runtime
  dependency on fie.org (it is meant to run on a separate server). Select with `?theme=fie`; the default look is
  still `classic`. Tokens only: FIE's pill header / card tiles / gradient sections are not implemented.
- **Gotcha:** a `url()` inside a custom property (e.g. `--logo`) resolves against the page *using* the variable,
  not the theme file — use absolute `/themes/<name>/…` paths there. (`@font-face` urls are fine relative.)
  The overview header has an empty `.brand-logo` slot that shows `--logo` when a theme defines it.
- **Overview tiles are iframes** of `/piste/N?embed=1`; the parent pushes its prefs via `postMessage` (children say
  `prefs-hello` on load), so a choice on the overview reaches every tile. Embedded pages ignore their own saved choice
  in favour of the parent's.
- **i18n:** flat JSON dictionaries in `public/i18n/<lang>.json`; English is always loaded as fallback. Static markup
  uses `data-i18n` / `data-i18n-title` / `data-i18n-alt`; script text uses `I18n.t(key, {n})`. Text built by script
  must be re-rendered inside an `I18n.subscribe(...)` callback (see the bottom of `updateMatch` in `main.js`).
  Keep key sets identical across the three files. FR/ES strings are unreviewed by native fencing speakers.
- Not themed/translated yet: `admin.html`, `piste-mgt.html`. Apparatus state letters (W/H/P/E) are codes, not words.

## OPP2 CONNECTION messages are a special case

The `connection` message type (topic `openpiste/{piste}/apparatus/connection`) is often delivered as the MQTT
broker's Last Will (LWT) for the device's own client, published automatically when its connection drops. LWT
payloads are static, defined once at connect time, so real ones on this broker are frequently bare
(e.g. `{"online": false}`) — no `protocol`/`version`/`seq` envelope. `OPP2.Deserializer.deserialize()` therefore
skips the protocol-envelope check specifically for `CONNECTION` (every other message type still requires
`protocol: "OPP2"`). Don't reintroduce a blanket protocol check without preserving that exception.

There are two independent "online" concepts, both surfaced in the v2 layout footer:
- **Scoring device connection** (`v2-connDot`, next to the state badge) — from the OPP2 `connection` message above.
- **Broker link** (`v2-brokerDot`, next to the Piste label) — whether *this page's own* MQTT client is connected,
  tracked via `mqttConnect()` / `client.onConnectionLost` in `main.js`. Not derived from any OPP2 message.

## Paho MQTT gotchas (mqttws31.min.js)

- `client.connect()` mutates the options object it's given and throws synchronously
  (`AMQJS0011E Invalid state already connected`) if called while already connected — build a fresh options object
  per attempt, and guard reconnect logic with `client.isConnected()` before calling.
- A clean `client.disconnect()` still triggers `onConnectionLost` in the bundled Paho build here, so reconnect
  logic doesn't need a separate code path for "intentional" vs. "unexpected" disconnects.

## Local dev/testing

- A local mosquitto broker runs on this machine: `1883` (plain TCP), `9001` (plain WS), `8883` (MQTTS) — see
  `config.json` for the URL the server-side code expects.
- `node test-publisher.js [piste_id]` publishes a simulated OPP2 bout (fencers/match/score/clock/lights/UW2F) to a
  given piste for manual testing, and sends `connection` online:true on connect / offline:false on Ctrl+C.
- To inspect what's actually retained on the broker (e.g. to check a real payload shape rather than assume it):
  `mosquitto_sub -h localhost -p 1883 -t 'openpiste/#' -v --retained-only`.

## Working-tree hygiene

This checkout regularly carries pending, unrelated changes (currently `install.sh`, `package-lock.json`, and a
handful of untracked screenshot/SVG/script files from other in-progress work). When asked to commit, scope the
commit to the files actually touched for the task at hand — don't sweep these in.

## Message source, board sizing, portrait and fullscreen

- **Where messages come from** is `public/js/source.js`: Paho MQTT to the page's own host by default (venue mode),
  or server-sent events when the host page declares `<meta name="opp2-source" content="sse" data-url="…">`
  (how openpiste-results shows this display without MQTT in the browser; it also sets `data-photos="off"`),
  or, for a display embedded in a page showing several pistes, `content="parent"`: the parent page feeds it over
  `postMessage` from its own single connection (`opp2-hello` in, `opp2`/`opp2-link` out, same origin only).
  `main.js` only talks to the source object (`start`/`setPiste`, `onMessage`/`onLink`/`onConnected`), never to Paho.
- **The board sizes itself in CSS**, not JS: `.scoring-container` is a size container (`pm-board`), the largest
  16:9 box that fits a landscape window, 9:16 on a portrait window, the whole screen in fullscreen/embed.
  Everything inside is sized in container units, **never `vmin`/`vh`/`vw`** (those follow the window, not the
  board, which is what used to push content off-screen in fullscreen and made phones unusable): v1 uses
  `cqmin`/`cqh`/`cqw`, v2 uses multiples of `--u` (`= 1cqh` on a 16:9 board, so the approved v2 design is unchanged).
  The name bars bleed over exactly `--board-pad`, which fullscreen sets to 0.
- **Portrait** is chosen by the board's own shape (`@container … (aspect-ratio < 1)`), so it applies windowed or
  fullscreen. v1: `.v1-wrap` and `.side-cards` are layout-only wrappers (`display: contents` in landscape, so the
  landscape layout is untouched) that become one grid. v2: the first name moves under the surname.
- **Pinning a preference:** a host page can add `<meta name="prefs-pin" content="mode=dark">` before `prefs.js`;
  the pinned value wins over everything (parent page included), is never saved, and `prefs-ui.js` shows no control
  for it. openpiste-results pins `mode=dark` so scoreboards stay dark while its own pages are in day mode.
- **Long names shrink to fit** (`fitNames()` in `main.js` sets `--fit`, which name font-sizes multiply by; floor
  0.3). It re-runs on a name change, a score change (the v2 priority mark widens the name line), a theme change,
  font load, and any board resize (ResizeObserver).
- **Open (2026-09-25):** the portrait arrangement above works (everything fits) but was judged confusing in real
  use; a different full-screen portrait layout is wanted, design not yet discussed. Separately, **iPhone Safari has
  no Fullscreen API for pages**, so the Fullscreen button does nothing there (portrait hides this because the
  board is phone-shaped; landscape shows it), and in phone landscape the button shrinks to ~62x21 px. Options are
  written up in openpiste-results `docs/design.md` §10.
