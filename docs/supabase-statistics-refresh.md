# Supabase statistics refresh setup

This project refreshes the `Estadísticas` section from AS.com on a schedule and stores the result in Supabase.

The flow is:

1. Create a cache table in Supabase.
2. Deploy an Edge Function that scrapes AS.com.
3. Disable JWT verification for that function if the caller is a cron job or API-key based request.
4. Schedule a `pg_cron` job that calls the function every 5 hours.
5. Read the cache from the frontend, with local JSON as fallback.

## 1. Create the cache table

Run `supabase/setup.sql`.

It creates:

- `mini_results`
- `as_rankings_cache`

The important part for statistics is `as_rankings_cache`, which stores one row per kind:

- `players`
- `teams`

If you are adding this to another project, keep the schema simple:

```sql
create table if not exists public.as_rankings_cache (
  kind text primary key,
  payload jsonb not null,
  source text not null default 'as.com',
  updated_at timestamptz not null default now()
);
```

Grant `select` to `anon` if the frontend must read it directly.

## 2. Deploy the Edge Function

Function path in this repo:

- `supabase/functions/sync-as-rankings/index.ts`

Deploy it with the Supabase CLI:

```bash
npx supabase link --project-ref <project-ref>
npx supabase functions deploy sync-as-rankings
```

The function:

- fetches the AS players rankings page
- fetches the AS teams rankings page
- scrapes each ranking table
- upserts both payloads into `as_rankings_cache`

## 3. Disable JWT verification for the function

Cron jobs and API-key-based callers commonly fail with `401` if the function keeps the default JWT check.

Add this to `supabase/config.toml`:

```toml
[functions.sync-as-rankings]
verify_jwt = false
```

Then redeploy the function.

Why:

- by default, Supabase Edge Functions expect a user JWT in `Authorization`
- a `sb_publishable_...` key is not a JWT
- if the caller is a cron job or webhook-like request, the platform must not reject it before your code runs

## 4. Enable pg_cron and pg_net

In the Supabase dashboard:

1. Open `Integrations`.
2. Open `Cron`.
3. Enable `pg_cron`.
4. Enable `pg_net` from `Database -> Extensions` if it is not already enabled.

If `cron.schedule(...)` fails with `schema "cron" does not exist`, `pg_cron` is not enabled yet.

## 5. Create the cron job

This repo uses a 5-hour schedule:

```sql
select cron.schedule(
  'sync-as-rankings-every-5h',
  '0 */5 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/sync-as-rankings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<publishable_key>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

If you want the exact SQL for this project, paste this version:

```sql
select cron.schedule(
  'sync-as-rankings-every-5h',
  '0 */5 * * *',
  $$
  select net.http_post(
    url := 'https://tsbjhbpdvewqysgmrhci.supabase.co/functions/v1/sync-as-rankings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Notes:

- use the function URL, not a dashboard URL
- the function endpoint should receive the project `publishable_key` in the `apikey` header
- if you prefer the official Supabase pattern, store `project_url` and `publishable_key` in Vault and read them from SQL

### Optional Vault version

Supabase recommends Vault for secrets. If you want that route, create two secrets:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<publishable_key>', 'publishable_key');
```

Then use:

```sql
select cron.schedule(
  'sync-as-rankings-every-5h',
  '0 */5 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/sync-as-rankings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 6. Verify it works

Run the function manually once or wait for the next cron window.

Check the cache table:

```sql
select kind, updated_at
from as_rankings_cache
order by kind;
```

You should see:

- `players`
- `teams`

## 7. Frontend fallback

The frontend should:

- read `as_rankings_cache` from Supabase first
- fall back to local JSON files if the cache is empty or unavailable

That keeps the app usable even if the cron job fails temporarily.
