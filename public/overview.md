# overview.html — Strips Overview Grid

Displays a live grid of fencing piste panels, each rendered as a scaled-down
iframe of the full piste display page (`/piste/<id>?embed=1`).

---

## URL Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `pistes`  | —       | Manual mode: comma-separated list of piste numbers to display (e.g. `?pistes=1,2,5`). No MQTT used. |
| `tiles`   | 32      | Maximum number of tiles shown in MQTT auto-discovery mode. |
| `cols`    | —       | Fixed-column mode: sets the number of columns (e.g. `?cols=4`). See below. |

Parameters can be combined, e.g. `?pistes=1,2,3,4&cols=2` or `?cols=4&tiles=20`.

---

## Display Modes

### 1. Fit-all mode (default, no `?cols`)

All visible tiles are scaled so that the entire grid fits within the browser
window — no scrolling needed.

- The number of columns is chosen automatically as `ceil(sqrt(count))`.
- Tile size shrinks as more tiles appear, so the whole grid always fits on screen.
- A **Fullscreen** button is shown in the header.

**Fullscreen behaviour:**
- The header (title, button, nav link) is hidden so only piste panels are visible.
- Padding and gaps are reduced to near-zero to maximise tile size.
- Tiles are constrained by both the viewport width *and* height, so nothing overflows.
- Exiting fullscreen restores the header and normal layout.

### 2. Fixed-column mode (`?cols=N`)

Tile size is fixed to `viewportWidth / N`. The number of columns stays constant
regardless of how many tiles are visible.

- Fewer tiles than `N` → only as many columns as there are tiles.
- More tiles than fit vertically → the page scrolls vertically; tiles never shrink.
- The **Fullscreen** button is hidden (scrolling inside fullscreen is not useful).

---

## Tile Discovery

### MQTT auto-discovery (default)

Subscribes to `MQTT_Cyrano/+/Connection` on the MQTT broker (same host,
port 9001 for HTTP or 9002 for HTTPS).

- When a retained `Connection` message arrives for a piste with any payload
  other than `offline`, that piste is added to the grid.
- When the payload is `offline`, the tile is removed.
- Tiles are always displayed in ascending piste-number order.
- The `?tiles=N` cap limits the maximum number of tiles shown (default 32).

### Manual mode (`?pistes=`)

Piste tiles are created immediately from the supplied list; no MQTT connection
is established. The `?tiles` cap is still respected as an upper bound but the
list itself is the primary filter.

---

## Tile Interaction

Clicking any tile opens the full piste display (`/piste/<id>`) in a new browser
tab.

---

## Technical Notes

Each tile iframe is always declared **1920 × 1080 px** internally. It is scaled
down purely with CSS `transform: scale(s)` where `s = colWidth / 1920`.
Because `transform` does not affect document flow, the wrapper `div` is sized
explicitly to the visual (scaled) dimensions and `overflow: hidden` is used to
clip the iframe to the visible tile area. This ensures that `1vh` / `1vw` units
inside the iframe always resolve correctly relative to the full 1920 × 1080
coordinate space, regardless of the visual tile size.
