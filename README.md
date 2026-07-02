# NBA Showdown 3D 🏀

A full-court, 5-on-5 3D basketball game that runs entirely in the browser — no build step, no dependencies to install. Built with [Three.js](https://threejs.org/) (loaded from CDN), procedural WebAudio sound, and a custom physics + AI engine.

![Gameplay](https://img.shields.io/badge/engine-three.js-blue) ![No build](https://img.shields.io/badge/build-none-brightgreen)

## Features

- **Regulation NBA court** — exact 94×50 ft dimensions, painted keys, three-point arcs with corner lines, restricted areas, hardwood plank floor, all rendered to a high-res canvas texture
- **Full arena** — four-sided stands with ~2,600 instanced crowd spectators, hanging four-sided jumbotron with a live score/clock feed, glass backboards, stanchions, spotlights, and real-time shadows
- **5-on-5 gameplay** — man-to-man defense, off-ball spacing, drives, kick-out passes, steals, contests, rebounds, and fast breaks
- **Real ball physics** — gravity, floor/rim/backboard collision with restitution, swishes vs. rattled-in makes, live rebounds off the iron
- **Timed shot meter** — hold Space to load, release in the green window for a perfect release; distance, defender contests, and player ratings all factor into shot quality
- **Full game rules** — 4 quarters, game clock, 24-second shot clock (14 on offensive boards), 2s and 3s, out of bounds, shot-clock violations, buzzer-beaters, and overtime
- **6 selectable teams**, 3 difficulty levels, and configurable quarter length
- **Procedural audio** — crowd bed that swells on big plays, ball bounces, rim clanks, backboard thuds, swishes, whistles, and buzzers, all synthesized with WebAudio (zero audio assets)

## Run it

Any static file server works (ES modules require http://, not file://):

```bash
# from the repo root — pick whichever you have:
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000 (or the URL `serve` prints).

## Controls

| Key | Action |
|-----|--------|
| `W A S D` / arrows | Move |
| `Shift` | Sprint |
| `Space` (hold + release) | Shoot — release in the green zone for a perfect shot |
| `Space` (on defense) | Jump / contest / rebound |
| `E` | Pass (offense) / switch player (defense) |
| `Q` | Steal |

You control the highlighted player (gold ring). On offense you always control the ball handler; on defense, press `E` to switch to the defender nearest the ball.

## Project layout

```
index.html        entry page, import map, menus & HUD markup
style.css         menu, scoreboard, shot meter, banner styling
src/
  main.js         renderer, broadcast camera rig, main loop
  constants.js    NBA court dimensions, teams, archetypes, difficulty
  arena.js        court texture, hoops, stands, crowd, jumbotron, lights
  player.js       procedural articulated player rig + animation
  ball.js         ball physics: flight, dribble, rim/board collision, scoring
  ai.js           offense/defense/loose-ball AI
  game.js         rules, clocks, possession, input, shot quality
  ui.js           HUD, menus, shot meter, banners
  audio.js        procedural WebAudio sound engine
```
