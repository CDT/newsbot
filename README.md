# Newsbot

A minimal news-digest system using Cloudflare Pages + Workers + D1, with Gemini summarization and Resend email delivery.

## Repo structure

```
/admin  -> Cloudflare Pages frontend (Vite + React)
/api    -> Cloudflare Worker API + scheduler
/db
  migrations.sql
wrangler.toml
```

## Prerequisites

- Cloudflare account (free tier works)
- D1 database
- Gemini API key
- Resend API key and verified sender domain

## Setup

1. Create a D1 database:
   ```sh
   wrangler d1 create newsbot
   ```
   Update `wrangler.toml` with the database ID.

2. Apply migrations:
   ```sh
   wrangler d1 execute newsbot --file db/migrations.sql --remote
   ```

3. For local development, create a `.dev.vars` file in the project root:
   ```sh
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your local values
   ```
   This file is gitignored and will be used by `wrangler dev` for local testing.

4. For production, set Worker secrets:
   ```sh
   wrangler secret put ADMIN_USERNAME
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put JWT_SECRET
   ```
   Set `CORS_ORIGIN` as a Worker variable to your Pages origin (for example `https://newsbot.pages.dev`).

5. Deploy the Worker:
   ```sh
   cd api
   npm install
   npm run deploy
   ```

6. Deploy the admin UI on Cloudflare Pages:
   - Option A (monorepo root):
     - Root directory: repository root
     - Build command: `npm install && npm run build`
     - Output directory: `dist`
   - Option B (admin subdirectory):
     - Root directory: `admin`
     - Build command: `npm install && npm run build`
     - Output directory: `dist`
   - If your API is on a Worker domain, set Pages environment variable `VITE_API_BASE_URL` to that Worker base URL (for example `https://newsbot-api.<your-subdomain>.workers.dev`).

## Usage

- Login at `/` using the admin credentials.
- Configure global settings with your Resend + Gemini keys.
- Add config sets with JSON arrays:
  - Sources: `[{"type":"rss","url":"https://example.com/rss"}]` or API sources like `{"type":"api","url":"https://api.example.com/news","items_path":"data.items"}`
  - Recipients: `["name@example.com"]`

## API endpoints

- `POST /api/login`
- `GET /api/global-settings`
- `PUT /api/global-settings`
- `GET /api/config-sets`
- `POST /api/config-sets`
- `PUT /api/config-sets/:id`
- `DELETE /api/config-sets/:id`
- `POST /api/run/:id`
- `GET /api/runs`

## Scheduling

Cron triggers are defined in `wrangler.toml`. Match `config_set.schedule_cron` values to the cron strings used by Cloudflare.

## Deployment

- Pages: set GitHub integration for auto-deploy on main.
- Worker: GitHub Actions workflow at `.github/workflows/deploy-worker.yml` deploys on merges to main.

## Local Development

- Use `.dev.vars` for local environment variables (already gitignored).
- For admin API base override, copy `admin/.env.example` to `admin/.env` and set `VITE_API_BASE_URL` when needed.
- Run the API locally: `cd api && npm run dev`
- Run the admin UI locally: `cd admin && npm run dev`
- The `.dev.vars` file should contain `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `JWT_SECRET`.

## Security notes

- Admin credentials are stored as Worker secrets in production.
- For local dev, use `.dev.vars` (gitignored).
- JWT is signed with `JWT_SECRET` and stored in an HttpOnly cookie; the UI uses bearer token in local storage.
- Never expose API keys in frontend environment variables.
