# Repository Guidelines

## Project Structure & Module Organization

- `admin` contains the Cloudflare Pages frontend (Vite + React).
- `api` contains the Cloudflare Worker API and scheduler.
- `db/migrations.sql` holds D1 schema migrations.
- `wrangler.toml` defines Worker/D1 bindings and cron triggers.
- `.github/workflows/deploy-worker.yml` deploys the Worker on main merges.

## Build, Test, and Development Commands

- `cd admin && npm install` installs the admin UI dependencies.
- `cd admin && npm run dev` runs the Vite dev server locally.
- `cd admin && npm run build` produces the Pages build output in `dist`.
- `cd admin && npm run lint` and `npm run format` check frontend code style.
- `cd api && npm install` installs Worker dependencies.
- `cd api && npm run dev` starts `wrangler dev` for the API.
- `cd api && npm run deploy` deploys the Worker.
- `cd api && npm run lint` and `npm run format` check API code style.
- `wrangler d1 execute newsbot --file db/migrations.sql --remote` applies schema updates.

## Coding Style & Naming Conventions

- TypeScript is strict (see `admin/tsconfig.json` and `api/tsconfig.json`), target ES2022.
- Use Prettier defaults (2-space indentation, single quotes where supported) via `npm run format`.
- React components use PascalCase (`App.tsx`); variables and functions use camelCase.
- Keep API handlers and utilities in `api/src` with clear, verb-based names.

## Testing Guidelines

- No automated test suite is currently configured.
- Validate changes via `npm run lint` and `npm run format` in each app.
- If adding tests, prefer `*.test.ts`/`*.test.tsx` colocated with the module.

## Commit & Pull Request Guidelines

- Recent history uses short, direct commit messages (e.g., “Add ...”).
- Keep commits focused; include a clear scope when touching both apps.
- PRs should include a summary, testing notes, and UI screenshots for admin changes.

## Security & Configuration Tips

- Store secrets with `wrangler secret put` (ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET).
- Never commit API keys or expose secrets in frontend environment variables.
- Match `config_set.schedule_cron` to cron strings defined in `wrangler.toml`.
