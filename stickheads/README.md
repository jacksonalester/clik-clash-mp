# STICKHEADS

Stick figures, real firepower. The BATTLEHEADS arena game — same maps, weapons, movement, modes and online server — with top-down stick-figure fighters and a quieter, flatter menu.

Live at `/stickheads/` on this site. Progress saves separately from BATTLEHEADS (`stickheads-save`).

| Path | What it is |
|---|---|
| `block1.js` | All game code. Gameplay is identical to the root `block1.js`; only rendering differs (stick rig, nameplates, menu backdrop). |
| `dev/src/shell.css` | Menu styles. The STICKHEADS restyle is the block at the end of the file. |
| `dev/src/logo.svg`, `icons.svg`, `*.b64` | Wordmark, icon sprite, embedded Barlow fonts (SIL OFL) and home-screen icon. |
| `index.html`, `manifest.webmanifest`, `sw.js`, `icon-*.png`, `og.png` | What players get. |

## Rebuild and verify

    python3 dev/build.py && python3 dev/gate.py

`dev/gate.py` runs the full BATTLEHEADS release gate against this build, including live online play against a local copy of the root `mp_server.js`.

## Online

STICKHEADS connects to the same server as BATTLEHEADS, so players of either game can land in the same match; each sees the other in their own art style.

© World Class Creative Design and Tech LLC
