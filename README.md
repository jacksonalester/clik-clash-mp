# BATTLEHEADS: ARENA

Tiny heads. Big warfare. A fast top-down arena shooter that runs in any modern browser on phone or desktop.

One repository, two deployments. Every commit to `main` updates both.

| File | What it is | Where it runs |
|---|---|---|
| `index.html` | The whole game in one file (release build, cheats off) | GitHub Pages |
| `mp_server.js` + `block1.js` + `package.json` | Authoritative multiplayer server (20 Hz, 5v5, bots fill empty seats) | Railway |
| `manifest.webmanifest`, `sw.js`, `icon-*.png`, `og.png` | Install-to-home-screen, offline play, share card | GitHub Pages |
| `privacy.html` | Privacy policy and terms (public URL for store listings) | GitHub Pages |
| `ATTRIBUTIONS.md` | Font and icon licenses | — |

`block1.js` is the exact game code that is inlined in `index.html`. The server runs it headless so the browser and the server share one rule set.

## Modes

Quickplay (free-for-all, six maps in rotation) · Search & Destroy 5v5 · Capture the Flag 6v6 · Battle Royale (20) · Pantheon (gods only) · Online live arena.

## Server

`npm start` runs `node mp_server.js`. Health check: `GET /` returns `{ok, game, map, clients, state, uptime}`.

Optional environment variables: `MP_MAP` (default `quarry`), `PORT`. Leave `MP_DEBUG` unset in production.

The game connects to the server URL built into `index.html`. Override it for testing with `?server=wss://your-host`.

## Release checklist

The build is gated by an automated browser suite (six device sizes, every screen, shop and pass economy, every mode, performance, crash recovery, safe areas, live online play) plus a two-client server test. Both must be fully green before a commit to `main`.

© World Class Creative Design and Tech LLC
