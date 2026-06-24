-- Ganador por penaltis en cruces que acaban en empate.
-- El marcador real del empate se conserva en result_home/result_away
-- (por si más adelante se puntúa con él); pen_winner solo indica quién pasa.
--   'team1' = pasa el local, 'team2' = pasa el visitante, null = sin decidir.

alter table public.porra_matches
  add column if not exists pen_winner text
    check (pen_winner is null or pen_winner in ('team1', 'team2'));
