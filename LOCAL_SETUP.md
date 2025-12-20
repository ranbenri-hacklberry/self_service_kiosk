# Local setup (do not commit secrets)

This project uses **Supabase** and a local **music backend** (`backend_server.js`).

## Secrets policy

- **Never** put `SUPABASE_SERVICE_KEY` (service_role) in any tracked file (including `.md`).
- Store secrets only in local env files that are already gitignored (like `.env.local`) or export them in your shell.

## Backend env (recommended)

Create a local file (NOT tracked by git):

`/.env.backend.local` *(gitignored by `.gitignore` patterns)*

Add:

```bash
SUPABASE_URL=__YOUR_SUPABASE_URL__
SUPABASE_SERVICE_KEY=__YOUR_SERVICE_ROLE_KEY__
```

Then run:

```bash
set -a
source .env.backend.local
set +a
node backend_server.js
```

## Frontend env

Use `.env.local` (already gitignored) for Vite:

```bash
VITE_SUPABASE_URL=__YOUR_SUPABASE_URL__
VITE_SUPABASE_ANON_KEY=__YOUR_ANON_KEY__
VITE_MUSIC_API_URL=http://localhost:8080
```


