# Newsbot

A minimal news-digest system using Cloudflare Pages + Workers + D1, with Gemini summarization and Resend email delivery.

## Repo structure

```
/apps
  /admin  -> Cloudflare Pages frontend (Vite + React)
  /api    -> Cloudflare Worker API + scheduler
/db
  migrations.sql
.github/workflows
  deploy-worker.yml
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
   wrangler d1 execute newsbot --file db/migrations.sql
   ```

3. Set Worker secrets:
   ```sh
   wrangler secret put ADMIN_USERNAME
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put JWT_SECRET
   ```

4. Deploy the Worker:
   ```sh
   cd apps/api
   npm install
   npm run deploy
   ```

5. Deploy the admin UI on Cloudflare Pages:
   - Set the root directory to `apps/admin`
   - Build command: `npm install && npm run build`
   - Output directory: `dist`

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

## Security notes

- Admin credentials are stored as Worker secrets.
- JWT is signed with `JWT_SECRET` and stored in an HttpOnly cookie; the UI uses bearer token in local storage.
- Never expose API keys in frontend environment variables.
