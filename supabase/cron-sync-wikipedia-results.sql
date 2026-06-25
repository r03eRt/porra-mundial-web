-- Cron de la Edge Function sync-wikipedia-results (app nueva).
-- Mantiene actualizado el caché public.event_results_cache con los datos de Wikipedia.
--
-- Requisitos previos (una sola vez, en Database → Extensions del dashboard):
--   - pg_cron habilitado
--   - pg_net habilitado
-- Y la Edge Function desplegada:
--   npx supabase functions deploy sync-wikipedia-results
-- (verify_jwt = false ya está en supabase/config.toml para que la pueda llamar el cron).
--
-- Cadencia: cada 4 horas (la app nueva todavía no consume el caché; basta con tenerlo
-- razonablemente al día). La propia función decide si re-scrapea o devuelve caché;
-- ?force=1 la fuerza. Cuando se enganche la app, subir la frecuencia (p.ej. */15).

-- Reprogramable: si el job ya existe, lo quitamos antes de recrearlo.
select cron.unschedule('sync-wikipedia-results-every-4h')
where exists (select 1 from cron.job where jobname = 'sync-wikipedia-results-every-4h');

select cron.schedule(
  'sync-wikipedia-results-every-4h',
  '0 */4 * * *',
  $$
  select net.http_post(
    url := 'https://tsbjhbpdvewqysgmrhci.supabase.co/functions/v1/sync-wikipedia-results?event=worldcup-2026',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_54vtwk64bp3Tm6yJm5zv5w_o_qEkvTw'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Comprobar que quedó programado:
--   select jobname, schedule, active from cron.job where jobname = 'sync-wikipedia-results-every-4h';
-- Ver últimas ejecuciones:
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'sync-wikipedia-results-every-4h')
--     order by start_time desc limit 10;
-- Para parar el cron:
--   select cron.unschedule('sync-wikipedia-results-every-4h');
