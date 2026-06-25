-- Corrige el árbol de cruces de la porra mundial-48-test, que se generó con una
-- plantilla R16/QF errónea (dos equipos del mismo grupo podían cruzarse antes de la
-- final). Alinea R16-7/R16-8/QF-2/QF-3 con el árbol oficial FIFA 2026.
-- La plantilla del código (admin-next/src/main.js) ya está corregida; esto arregla
-- los datos ya generados. Para otras porras: regenerar cruces desde el admin.

update public.porra_matches m
set team1_id = v.t1, team2_id = v.t2
from (values
  ('R16-7', 'W:R32-14', 'W:R32-16'),
  ('R16-8', 'W:R32-13', 'W:R32-15'),
  ('QF-2',  'W:R16-5',  'W:R16-6'),
  ('QF-3',  'W:R16-3',  'W:R16-4')
) as v(match_id, t1, t2)
where m.match_id = v.match_id
  and m.porra_id = (select id from public.porras where slug = 'mundial-48-test');
