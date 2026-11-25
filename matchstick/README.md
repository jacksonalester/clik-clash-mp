# MATCHSTICK

A fast top-down stick-figure arena shooter. Tap **Play now** and you are in a match on a random map against bots.
A separate game from BATTLEHEADS: ARENA, built fresh. Every character, map, effect and sound is made in code.

- Play: `index.html` (one self-contained file, about 400 KB, nothing loaded from other sites)
- Install: add to home screen on a phone (manifest and icons included)
- Modes: Deathmatch (first to 20), Teams (first to 40), Party (changes daily)
- Maps: Yard, Depot, Atrium, Crossing, Greenhouse, Volt

## Build from source

```
cd matchstick/dev
mkdir -p vendor && (cd vendor && npm init -y >/dev/null && npm install @fontsource/barlow@5 @fontsource/barlow-condensed@5 @phosphor-icons/core@2)
python3 tools/build.py          # writes dist/matchstick.html, dist/artifact.html, dist/web/index.html
node tools/simtest.js           # 18 bot-only matches on every map and mode
python3 tools/gate.py           # 230 browser checks on six screen sizes (needs Playwright)
cp dist/web/index.html ../index.html
```

Source order: `util, data, sim, bots, draw, render, audio, input, save, ui, main` (plain JS, one shared scope).
`sim.js` and `bots.js` have no DOM, so the same code can run on a multiplayer server later.

Fonts: Barlow and Barlow Condensed (SIL Open Font License). Icons: Phosphor (MIT).
© 2026 World Class Creative Design and Tech LLC. Studio: Alsuja Games.
