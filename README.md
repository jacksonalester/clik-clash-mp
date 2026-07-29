# CLIK! CLASH — multiplayer server + web game

One repo, two deployments:
- **Server** (`mp_server.js` + `block1.js` + `package.json`) → Railway: authoritative WebSocket game server (20Hz tick, team-balanced player claims, bot backfill on disconnect).
- **Game** (`index.html`) → the full game, release build (dev cheats off), self-contained single file. Serve via GitHub Pages (Settings → Pages → main branch → root) or Vercel git-import.

Server env vars (optional): `MP_MAP` (default `quarry`). Leave `MP_DEBUG` unset in production — it gates test-only debug messages.
Health check: `GET /` returns `{ok:true, game:"CLIK! CLASH MP", clients, state, uptime}`.

