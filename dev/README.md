# Working on BATTLEHEADS: ARENA

Everything needed to change, rebuild and re-verify the game lives in this repository.

| Path | What it is |
|---|---|
| `block1.js` | All game code (gameplay + menus). The server runs this same file. Edit this. |
| `dev/src/shell.css` | Every menu style. Colors, radii, shadows and timings are tokens at the top. |
| `dev/src/shell.html` | Menu markup: hub, modes, shop, locker, ladder, pass, profile, settings, results, pause, modals. |
| `dev/src/head.html` | Page title, description, share-card and install tags. |
| `dev/src/icons.svg`, `logo.svg` | Icon sprite and the vector logo. |
| `dev/src/*.b64` | Embedded fonts and the home-screen icon. |

## Rebuild

    python3 dev/build.py

Writes `index.html` (what players get) and `dev/out/dev.html` (everything unlocked, never deployed).

## Verify before every commit to main

    npm install
    pip install playwright && python3 -m playwright install chromium
    python3 dev/build.py && python3 dev/gate.py && node dev/mp_test.js

`dev/gate.py` drives a real browser through six device sizes, every screen, the shop and pass economy, every mode, performance, crash recovery, safe areas and live online play against a local copy of the server. `dev/mp_test.js` joins two clients to the server. Ship only when both are fully green.
