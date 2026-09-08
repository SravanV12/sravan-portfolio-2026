# sravan-portfolio-2026

Personal portfolio for Sravan V — full-stack developer, web, mobile and
desktop.

Built with Next.js (App Router), TypeScript and Tailwind. Content is managed
in a CMS and fetched at build time, so every page ships as static HTML.

Repository: https://github.com/SravanV12/sravan-portfolio-2026

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## After a fresh clone — required

Git hooks live in a tracked `.githooks/` directory rather than `.git/hooks`,
which git does not clone. Point git at them once per clone:

```bash
git config core.hooksPath .githooks
```

Without this the pre-commit, commit-msg and pre-push checks do not run.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Design tokens

Colour and type are defined once, in the `@theme` block of
`src/app/globals.css`. That file is the only place a raw colour value may
appear — everything else references a token.
