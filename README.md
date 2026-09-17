# Stackcraft

A game-like PWA that teaches Linux, Python, and SQL from zero. Build your stack, one layer a day.

- `npm run dev` starts the dev server.
- `npm run build` type-checks and builds to `dist/`.
- `npm test` runs the shell smoke tests, the SM-2 scheduler tests, and every lesson's reference solution through its checker.
- Lessons are data files under `src/content/<track>/<week>-<day>.ts`. See `SPEC.md` for the full plan.
- Deploys to GitHub Pages on every push to `main`.
