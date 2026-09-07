# PRD: Planetary Artillery MVP

Status: ready-for-agent

## Problem Statement

I want to play a short, good-looking 3D artillery duel in my browser without
installing anything, logging in, or waiting on a server. The classic
angle-and-power artillery loop is fun, but flat-terrain versions feel dated and
the tactical space is shallow. I want the *planet itself* — its curvature,
gravity, wind, and terrain — to be the puzzle: I should have to think about
firing over the horizon of a small world, leading a shot into the wind, and
carving the ground out from a hillside my opponent is hiding behind. I want each
match to look distinct, last about five minutes, and end with a satisfying
explosion — all against an AI that feels like it's genuinely aiming, not
cheating.

## Solution

A fully client-side, turn-based 3D artillery game. Each match procedurally
generates a spherical **Planet** (Earth-like or Mars-like **Preset**) and places
one player **Tank** and one AI **Tank** far apart on valid terrain. On your
**Turn** you orbit the camera to read the world, adjust turret **Bearing** and
**Elevation** with the arrow keys, hold Space to build **Power**, and release to
fire a single **Shot**. The projectile follows a ballistic arc bent by
planet-centred gravity and **Wind**; a translucent **Trajectory guide** previews
roughly the first quarter of the arc. Impacts deal **Blast** damage that falls
off with distance and carve persistent **Craters** into the terrain — except
under a **Tank footprint** and on **Water**, which only splashes. A three-tier AI
uses the same physics, learns from its own misses, and misses believably. The
match ends when a tank hits zero health, with a cinematic destruction sequence
and a winner overlay offering a fresh match. A development-only debug panel
exposes the tuning surface live.

## User Stories

1. As a player, I want to start a match without any backend, account, or install, so that I can play instantly in my Chromium browser.
2. As a player, I want each match to generate a fresh, procedurally created planet, so that matches feel distinct.
3. As a player, I want to choose between an Earth-like and a Mars-like planet preset, so that I can play worlds with different gravity, wind, and looks.
4. As a player, I want the Earth-like preset to show water, green/brown land, haze, clouds, and snow on high terrain, so that it reads as a living world.
5. As a player, I want the Mars-like preset to show red/rust dry terrain with a dusty atmosphere and little or no water, so that it feels distinct from Earth-like.
6. As a player, I want planet radius to vary between matches, so that curvature and shot range change the tactical problem.
7. As a player, I want a loading screen with a visible progress indicator during generation, so that the ~5–10s wait never feels frozen.
8. As a player, I want a brief cinematic flyover of the generated planet before play, so that I can take in its shape and terrain.
9. As a player, I want the camera to settle on my tank and indicate my turn, so that I know it's time to aim.
10. As a player, I want to freely orbit, pan, and zoom the camera around the planet, so that I can inspect terrain and find the enemy tank.
11. As a player, I want camera movement to feel smooth and responsive rather than draggy, so that reading the world is pleasant.
12. As a player, I want to adjust turret bearing with the left/right arrow keys, so that I can aim horizontally.
13. As a player, I want to adjust cannon elevation with the up/down arrow keys, so that I can aim vertically.
14. As a player, I want to hold arrow keys for continuous, smooth turret adjustment, so that fine aiming is comfortable.
15. As a player, I want to hold Space to charge power and release to fire, so that shot strength is a timing skill.
16. As a player, I want a visible power meter while charging, so that I can judge my release.
17. As a player, I want a trajectory guide that emerges from the cannon and updates as I change aim and power, so that I can plan a shot.
18. As a player, I want the guide to show only about the first 25% of the arc and never the landing point, so that aiming stays skill-based.
19. As a player, I want the guide, before I start charging, to reflect my last shot's power (a mid-range default on the first shot), so that I can range in from a known baseline.
20. As a player, I want my shot to curve under planet-centred gravity rather than fall along a fixed axis, so that firing around a curved world works.
21. As a player, I want wind to push my projectile by a strength and direction shown on the HUD, so that I can compensate.
22. As a player, I want a small inherent shot variance, so that shots feel grounded rather than robotic, without being random.
23. As a player, I want the camera to follow my projectile cinematically and keep the impact visible, so that I can see the result.
24. As a player, I want impacts to deal maximum damage at the centre and less further out, to zero beyond the blast radius, so that near-misses still matter.
25. As a player, I want a direct or very close hit to be able to defeat a full-health tank in about two strong hits, so that matches stay short.
26. As a player, I want impacts to carve visible craters that persist for the whole match, so that the battlefield records the fight.
27. As a player, I want craters to never heal, fade, or be capped, so that repeated hits visibly scar the planet.
28. As a player, I want the ground directly under a tank to never be carved away, so that tanks are never left floating and can only be killed by blast damage.
29. As a player, I want shots that land in water to splash instead of cratering the seabed, so that lakes read as cover rather than diggable terrain.
30. As a player, I want to still deal blast damage to a shoreline tank when I land just short in shallow water, so that water isn't a damage-immunity exploit.
31. As a player, I want input locked while a shot is in flight and resolving, so that I don't accidentally interfere with the sequence.
32. As a player, I want to keep orbiting the camera while the AI is thinking, so that I can survey the board between turns.
33. As a player, I want to take the first turn of a match, so that the opening is mine.
34. As a player, I want to face three AI difficulty levels, so that I can pick a fair challenge.
35. As a player facing Easy AI, I want it to miss visibly and sometimes overcorrect, so that beginners can win.
36. As a player facing Medium AI, I want it to walk its shots toward me over several turns, so that it feels like a competent opponent.
37. As a player facing Hard AI, I want it to compensate well for wind and gravity and learn quickly, but never cheat with hidden information, so that losing feels fair.
38. As a player, I want the AI to be subject to the same shot variance I am, so that it isn't unnaturally perfect.
39. As a player, I want a minimal HUD showing both tanks' health, wind, the current turn, and the power meter, so that I have what I need without clutter.
40. As a player, I want a concise damage readout after an impact, so that I understand the effect of a hit.
41. As a player, I want turret bearing and elevation shown as compact numbers, so that I can aim precisely if I want to.
42. As a player, I want simple sounds for firing, flight, impact, explosion, and destruction, so that actions have feedback.
43. As a player, I want a match-ending hit to trigger an enhanced destruction sequence — large explosion, fire, smoke, debris, a subtle camera shake, and a brief linger — so that winning feels climactic.
44. As a player, I want a clean winner overlay at the end, so that the outcome is clear.
45. As a player, I want a "New Match" action at the end that generates a fresh planet, so that I can immediately play again.
46. As a player, I want the game to run smoothly on a reasonable modern desktop Chromium browser, so that the experience stays fluid.
47. As a player, I want a pause/settings affordance, so that I can step away or adjust.
48. As a developer, I want a toggleable debug panel overlaid in a corner, organised into collapsible sections, so that I can inspect and tune the game.
49. As a developer, I want to edit tunable values live and see them classified as live / next-shot / regenerate / new-match, so that I understand when each change takes effect.
50. As a developer, I want to trigger a planet regeneration when a change requires it, so that I can iterate on generation.
51. As a developer, I want to view and enter an internal seed in the debug panel, so that I can reproduce a specific planet while debugging generation.
52. As a developer, I want performance metrics (FPS, frame time, generation time, AI solve time, crater update time) surfaced, so that I can find hotspots.
53. As a developer, I want the trajectory guide, the live shot, and the AI to all use one shared simulation, so that they can never disagree.
54. As a developer, I want deterministic, seeded generation, so that a logged seed reproduces a planet for bug reports.
55. As a developer, I want the game rules and simulation to run headless (no Three.js), so that I can unit-test them.


## Further Notes

- The whole game is a static client-side build (HTML shell + hashed JS/CSS + 3D,
  texture, and audio assets); no runtime API, database, or auth. CI gates:
  typecheck, lint, unit tests, production build; add the Chromium smoke suite once
  the first playable loop exists.
- Numeric defaults in `docs/` (400 HP, 200 max damage, ~5% variance, 25% guide,
  45% guide opacity, etc.) are initial values, tunable via TuningRegistry, not
  hard constraints — except the explicit fixed rules (no crater cap, no crater
  fade, terrain removal only, symmetry not required).
  