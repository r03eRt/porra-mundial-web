# Spec retrospectiva: Porrazo 2026

## 1. Objetivo del documento

Este documento describe la especificación que habría sido ideal definir al inicio del proyecto para llegar de forma ordenada al estado actual de `Porrazo 2026`.

La idea es que este archivo sirva como:

- base funcional del producto
- alcance cerrado de la primera versión
- guía de implementación técnica
- documento que se le podría pasar a un agente como contexto inicial de trabajo

## 2. Resumen del producto

Queremos una web responsive para gestionar una porra del Mundial 2026 basada en un Excel ya existente con:

- participantes
- predicciones de fase de grupos
- predicciones de cruces
- respuestas de mini-porra

La aplicación debe calcular automáticamente la clasificación principal de la porra y mostrar varias vistas de seguimiento del torneo, apoyándose en resultados reales del Mundial y en estadísticas externas cacheadas.

Además, debe existir un modo administrador para corregir datos sin reexportar el Excel ni rehacer el dataset base.

## 3. Objetivos de negocio y producto

### Objetivos principales

- Tener una única web compartible con toda la porra.
- Evitar cálculos manuales sobre el Excel durante el torneo.
- Mostrar una clasificación siempre actualizada con los resultados reales.
- Centralizar correcciones administrativas sin tocar el dataset base.
- Añadir vistas que hagan la porra más entretenida: histórico, comparador, cruces, probabilidades y estadísticas.

### Objetivos secundarios

- Poder desplegarlo como web estática.
- Reducir dependencia de peticiones directas desde cada móvil.
- Mantener buena experiencia en móvil, especialmente iPhone/Safari.

## 4. Usuarios

### 4.1 Participante

Puede:

- consultar la clasificación principal
- revisar partidos y predicciones
- ver la mini-porra
- consultar histórico, comparador, cruces y estadísticas
- seguir el estado del torneo

No puede:

- editar datos oficiales
- modificar respuestas corregidas
- forzar sincronizaciones administrativas

### 4.2 Administrador

Puede hacer todo lo anterior y además:

- iniciar sesión
- editar resultados de mini-porra
- crear correcciones manuales sobre predicciones cargadas desde Excel
- importar y exportar estado auxiliar
- forzar refrescos de caché remota
- cambiar la URL de la fuente de resultados si hace falta

## 5. Alcance funcional de la v1

La v1 debe incluir estas secciones y comportamientos.

### 5.1 Clasificación principal

La app debe:

- calcular puntos por participante según resultados reales disponibles
- ordenar la clasificación por puntos totales
- mostrar desempates y métricas auxiliares
- permitir buscar participantes
- mostrar puntos de fase de grupos y de cruces

### 5.2 Histórico

La app debe:

- reconstruir la clasificación tras cada partido resuelto
- permitir avanzar partido a partido
- mostrar evolución de posiciones
- permitir consultar un checkpoint concreto

### 5.3 Mini-porra

La app debe:

- mostrar ranking independiente de la mini-porra
- mostrar preguntas, respuestas y resultados corregidos
- mantener esta clasificación separada de la porra principal
- permitir al admin guardar y limpiar resultados de cada pregunta

### 5.4 Partidos

La app debe:

- listar todos los partidos del dataset
- listar también el calendario de eliminatorias con horario y sede, aunque los equipos futuros sigan viniendo como seed
- resolver automáticamente esos seeds a selecciones reales cuando la clasificación o el ganador ya estén decididos
- indicar si un partido está resuelto o pendiente
- permitir filtrar por grupo, selección y estado
- mostrar grupos y eliminatorias en bloques plegables para no ocupar demasiada altura
- mostrar al abrir un partido las predicciones de todos los participantes

### 5.5 Cruces

La app debe:

- mostrar el cuadro previsto por cada participante
- mostrar desde dieciseisavos hasta campeón
- mantener el lado visual correcto del árbol aunque una ronda superior ya venga resuelta a nombre real en vez de `Wxx`
- calcular puntuación de cruces cuando haya datos suficientes
- permitir cambiar rápidamente de participante

### 5.6 Clasificación por grupos

La app debe:

- calcular la clasificación real de cada grupo con los resultados disponibles
- mostrar puntos, goles, diferencia y orden final
- actualizarse automáticamente cuando entren nuevos resultados

### 5.7 Detalle por participante

La app debe:

- mostrar las predicciones completas de un participante
- permitir revisar por grupos y por fases
- dejar ver rápidamente dónde está acertando o fallando

### 5.8 Equipos

La app debe:

- ofrecer una lista de selecciones del torneo
- permitir buscar una selección
- mostrar detalle estadístico del equipo
- incluir métricas agregadas calculadas desde los partidos jugados

### 5.9 Mejores terceros

La app debe:

- calcular el ranking de terceros clasificados
- ordenar por puntos, diferencia de goles y goles a favor
- mostrar qué terceros avanzarían en ese momento

### 5.10 Máximos goleadores

La app debe:

- mostrar el top de goleadores reales del torneo
- excluir autogoles
- actualizarse con la misma fuente de resultados/cache que el resto

### 5.11 Probabilidades

La app debe:

- estimar probabilidades de ganar la porra principal
- estimar probabilidades de ganar la mini-porra
- estimar probabilidades de avance por selección en cruces
- usar simulación Monte Carlo sobre partidos pendientes

### 5.12 Estadísticas externas

La app debe:

- mostrar rankings de jugadores y selecciones
- apoyarse en una fuente externa de estadísticas
- permitir cambiar entre modo jugadores y modo equipos
- filtrar por ranking y búsqueda textual

### 5.13 Comparador

La app debe:

- permitir seleccionar un partido
- comparar cómo lo pronosticaron uno o dos participantes
- contrastar predicción con resultado real

### 5.14 Tarjeta de partido en directo

La portada/resumen debe poder mostrar:

- partido destacado en directo o finalizado
- marcador, minuto/estado y enlace al seguimiento externo
- si muestra el último partido, decidirlo por la hora real del encuentro y no por la hora del último refresco del feed
- refresco más frecuente cuando haya un directo activo

### 5.15 Ajustes y herramientas admin

El modo admin debe incluir:

- login con Supabase Auth
- edición de resultados mini-porra
- corrección manual de predicciones de fase de grupos
- corrección manual de pronósticos de cruces
- corrección manual de respuestas mini-porra
- refresco manual de caché de resultados
- refresco manual de caché de estadísticas
- refresco manual de caché del directo de AS
- exportación/importación del estado auxiliar

## 6. Reglas de negocio

### 6.1 Puntuación fase de grupos

- marcador exacto: 3 puntos
- signo acertado: 2 puntos
- fallo: 0 puntos

### 6.2 Puntuación cruces

La app debe soportar puntuación por ronda:

- dieciseisavos: 3 puntos
- octavos: 5 puntos
- cuartos: 7 puntos
- semifinales: 10 puntos
- final: 12 puntos
- campeón: 15 puntos

### 6.3 Mini-porra

- su ranking es independiente
- no suma a la clasificación principal
- algunas preguntas son de texto, otras de equipo, jugador o número
- puede haber heurística para probabilidades mientras preguntas sigan abiertas

### 6.4 Correcciones manuales

- nunca deben sobrescribir el dataset base generado desde Excel
- deben aplicarse como una capa adicional en tiempo de ejecución
- deben poder revertirse individualmente

## 7. Fuentes de datos

### 7.1 Dataset base

Fuente inicial:

- Excel `PORRA MUNDIAL 2026 VILLAVERDE.xlsx`

Debe convertirse a un fichero JS/JSON embebido con:

- metadata
- participantes
- partidos
- predicciones
- mini-preguntas y respuestas
- predicciones de cruces
- aliases de equipos

### 7.2 Resultados reales del Mundial

Fuente principal prevista:

- OpenFootball World Cup JSON 2026

Condición:

- el frontend no debe depender exclusivamente de llamadas directas desde cada dispositivo

### 7.3 Estadísticas externas

Fuente:

- rankings cacheados desde AS

Condición:

- debe existir fallback local en JSON si el cache remoto falla

### 7.4 Directo destacado

Fuente:

- cache remota construida a partir de datos de AS

## 8. Arquitectura de datos deseada

### 8.1 Principio general

Separar claramente:

- dataset base de la porra
- datos vivos del torneo
- correcciones administrativas
- estado local del navegador

### 8.2 Fuente de verdad por capa

- `window.PORRA_DATA`: base estática generada desde Excel
- `worldcup_results_cache`: resultados y calendario cacheados
- `as_rankings_cache`: estadísticas de jugadores y selecciones
- `as_live_match_cache`: partido en directo destacado
- `mini_results`: resultados corregidos de mini-porra
- `prediction_overrides`: correcciones admin sobre predicciones
- `localStorage`: preferencias, caché temporal y estado UI auxiliar

### 8.3 Requisito clave

La app debe poder seguir funcionando aunque fallen temporalmente:

- cron jobs
- fuente externa de resultados
- fuente externa de estadísticas

## 9. Requisitos técnicos

### 9.1 Frontend

- aplicación web estática
- responsive mobile-first
- sin dependencia de backend propio tradicional
- build simple con Vite
- renderizado en cliente con JavaScript vanilla

### 9.2 Backend ligero

Usar Supabase para:

- autenticación del administrador
- tablas cache
- tablas editables
- funciones programadas

### 9.3 Sincronización

Debe existir un mecanismo programado para:

- refrescar resultados del Mundial
- refrescar rankings externos
- refrescar tarjeta de directo

La lógica de refresco debe vivir en las funciones y no en múltiples cron jobs distintos con inteligencia duplicada.

### 9.4 Fiabilidad en móvil

- evitar dependencia fuerte de service workers
- priorizar frescura y consistencia de datos sobre modo offline
- refrescar al recuperar foco o conexión

## 10. Modelo de datos mínimo

### 10.1 Participante

- `id`
- `name`
- columnas de procedencia en Excel

### 10.2 Partido base

- `id`
- `group`
- `team1`
- `team2`
- `predictions` por participante

### 10.3 Pregunta mini

- `id`
- `label`
- `points`
- `answers` por participante
- `fieldType`

### 10.4 Predicción de cruces

- `stage`
- `slot`
- `predictions` por participante

### 10.5 Override admin

- `player_id`
- `scope`
- `entity_id`
- `value`

## 11. UX esperada

### 11.1 Portada

Debe mostrar de un vistazo:

- nombre de la porra
- última actualización
- acciones rápidas
- tarjetas resumen

### 11.2 Navegación

Debe estar organizada por pestañas funcionales:

- clasificación
- histórico
- mini-porra
- partidos
- cruces
- grupos
- detalle jugador
- equipos
- mejores terceros
- goleadores
- probabilidades
- estadísticas
- comparador
- admin
- datos/API

### 11.3 Feedback

La app debe mostrar:

- estados de carga
- errores de sincronización
- confirmaciones de guardado admin
- aviso de nueva versión si se publica una build más reciente

## 12. Fuera de alcance inicial

Estas cosas no eran necesarias para llegar a la versión actual y deberían haberse dejado fuera del primer alcance:

- edición masiva de predicciones por usuario final
- registro público de usuarios
- backend completo propio
- tiempo real perfecto play-by-play
- modo offline real
- app nativa
- sistema de pagos
- notificaciones push complejas multiusuario

## 13. Plan de implementación recomendado

### Fase 1. Base funcional

- convertir Excel a dataset estructurado
- montar frontend estático
- calcular clasificación principal
- mostrar partidos, mini-porra y detalle jugador

### Fase 2. Datos vivos

- integrar resultados reales del Mundial
- mover refresco a Supabase cache
- añadir histórico y clasificación por grupos

### Fase 3. Capas avanzadas

- cruces
- equipos
- mejores terceros
- máximos goleadores
- comparador

### Fase 4. Capa admin

- login
- edición mini-porra
- overrides de predicciones
- acciones manuales de sincronización

### Fase 5. Capa analítica

- probabilidades por simulación
- rankings externos
- tarjeta de directo

## 14. Criterios de aceptación

El producto se considera correcto cuando:

1. La clasificación principal se recalcula sola al entrar nuevos resultados.
2. La mini-porra mantiene su ranking separado.
3. El admin puede corregir datos sin tocar el dataset base.
4. La web sigue siendo usable si falla una fuente externa, gracias a caches y fallbacks.
5. Las vistas clave funcionan en móvil sin problemas graves de caché.
6. Los datos visibles tienen una fecha/hora de actualización reconocible.

## 15. Riesgos que habría convenido identificar desde el principio

- OpenFootball no es una fuente live oficial.
- Safari/iPhone puede cachear de forma agresiva.
- Las estadísticas externas pueden romperse si cambia la fuente.
- Si todo dependiera del frontend, cada móvil haría peticiones redundantes e inconsistentes.
- Corregir directamente el dataset base habría sido frágil y poco auditable.

## 16. Brief corto para pasar a un agente desde el día 1

Si esto hubiera que resumirlo en un briefing útil para construir la app, sería este:

> Quiero una web estática responsive para una porra del Mundial 2026 basada en un Excel existente. El Excel contiene participantes, predicciones de fase de grupos, mini-porra y cruces. La app debe calcular automáticamente la clasificación principal y mostrar secciones de histórico, partidos, mini-porra, cruces, clasificación de grupos, detalle por jugador, equipos, mejores terceros, goleadores, probabilidades, estadísticas externas y comparador. Los resultados reales deben venir de una fuente externa cacheada en Supabase, no desde llamadas directas por cada cliente. También necesito modo administrador con login para corregir mini-porra y predicciones mediante overrides, sin modificar nunca el dataset base generado desde el Excel. Prioriza fiabilidad en móvil, fallbacks si fallan fuentes externas y despliegue sencillo como web estática.

## 17. Qué documento habría sido suficiente de verdad

Si me hubieras pasado al principio un único documento, con esto habría bastado:

- objetivo del producto
- listado cerrado de pantallas
- reglas de puntuación
- roles y permisos
- fuentes de datos
- prioridad de la fuente de verdad
- operaciones de administrador
- restricciones técnicas
- criterios de aceptación

Eso habría evitado la mayor parte de decisiones reactivas de arquitectura y habría dejado claro desde el principio que esto no era solo “una web que lee un Excel”, sino una app con:

- cálculo
- sincronización
- caché
- administración
- analítica
- tolerancia a fallos
