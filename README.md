# Timeless: The Last Artifacts

A responsive single-page prototype of the point-and-click roguelite adventure "Timeless: The Last Artifacts." Explore randomized steampunk-inspired chambers, balance sanity against a relentless clock, and experiment with double-edged artifacts that reshape each run.

## Getting Started

This build is framework-free and runs entirely in the browser.

1. Open `index.html` in any modern desktop or mobile browser, or
2. Serve the folder with your preferred static server (e.g. `npx serve`).

No build step is required.

## Gameplay Highlights

- **Procedural chambers:** Each run samples five unique scenes from a pool of eight handcrafted layouts featuring puzzles, dialogue choices, and exits.
- **Dynamic artifacts:** Every artifact carries positive, neutral, and negative traits (with rare items skewing positive) that alter sanity drain, available hints, and chamber logic.
- **Branching dialogue:** Conversational choices provide meaningful trade-offs that reshape available routes, clues, and resources.
- **Sanity vs. time:** Maintain a draining sanity meter and a five-minute chronometer while artifacts and decisions modulate both.
- **Inventory & log:** Track collected artifacts and narrative beats via a lightweight inventory panel and timestamped event log.

## Customization Hooks

Game data lives directly inside `main.js`:

- **Artifacts:** Update the `ARTIFACTS` array to tweak effects or expand the pool.
- **Scenes:** Modify entries in the `SCENES` array to add new chambers, hotspots, puzzles, and dialogue.
- **Balancing:** Adjust constants in `GAME_CONFIG` to tune run length, sanity drain, or time limits.

Feel free to extend the DOM/CSS scaffolding in `index.html` and `style.css` for richer visuals as assets become available.
