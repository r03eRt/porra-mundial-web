-- Programa el cron de sync-wikipedia-results (cada 4 horas).
-- pg_cron y pg_net ya están habilitados (la legacy los usa para sync-worldcup-results).
-- La app nueva todavía no consume event_results_cache; 4 h basta para tenerlo al día.
-- Cuando se enganche la app, subir la frecuencia (re-ejecutar con otro schedule).

-- Idempotente: si el job ya existe, lo quitamos antes de recrearlo.
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
