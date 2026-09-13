# Contrato del temporizador

## Configuraciones

| Modalidad | Datos relevantes |
|---|---|
| Sin timer | Ninguno; Start no disponible |
| Countdown | Duracion positiva |
| Intervalos | Preparacion, trabajo, descanso, ciclos, sets y descanso entre sets |

Los rangos validos son los definidos en [document-schema.md](document-schema.md): countdown 60-86400 segundos; preparacion, descanso y descanso entre sets 0-3600; trabajo 1-3600; ciclos 1-100; sets 1-20. El validador runtime es unico y compartido por editor, proyector y motor.

## Plan de countdown

Un countdown produce una sola fase de trabajo con la duracion configurada y despues `done`.

## Plan de intervalos

1. Preparacion global, si su duracion es mayor que cero.
2. Trabajo para cada ciclo del set.
3. Descanso de ciclo solo cuando queda otro ciclo en el mismo set.
4. Descanso entre sets solo cuando queda otro set.
5. `done` inmediatamente despues del ultimo trabajo.

Preparacion ocurre una sola vez. Las fases de duracion cero se omiten. Debe existir al menos una fase de trabajo positiva.

## Estado publico

| Estado de sesion | Significado |
|---|---|
| `idle` | No hay sesion ocupando el singleton |
| `running` | Existe una fase activa |
| `done` | El plan termino y espera ser descartado |

Cada snapshot expone modalidad, fase, deadline, duracion de fase, restante, progreso, ciclo y set cuando aplican, actividad y rutina de origen.

Las fases distinguibles son preparacion, trabajo, descanso de ciclo y descanso entre sets. La UI no debe inferir la clase de descanso solo por color.

## Comandos MVP

| Comando | Regla |
|---|---|
| Start | Crea una sesion solo si el singleton esta libre |
| Tick | Recalcula desde el timestamp actual |
| Cancel | Descarta una sesion en ejecucion sin completar |
| Dismiss | Libera una sesion `done` |
| Open focus | Muestra la sesion existente |

Pausa, reanudacion, skip y reset no forman parte del MVP. Agregarlos exige ampliar este contrato y sus pruebas.

## Tiempo

- El motor usa deadlines absolutos derivados de una fuente equivalente a `Date.now()`.
- Nunca depende de restar un segundo por tick.
- Si una actualizacion llega tarde, atraviesa todas las fases vencidas manteniendo los deadlines originales.
- El restante visible redondea hacia arriba y nunca es negativo.
- Tras una suspension larga, la UI salta al estado actual y emite como maximo una alerta sonora, no una rafaga por cada fase omitida.

## Singleton

- Solo una sesion ocupa el timer por pestana, incluyendo `done` sin descartar.
- Un segundo Start se rechaza y ofrece volver al timer existente.
- La sesion usa un snapshot; editar o eliminar el bloque origen no la modifica.
- La navegacion cliente conserva la sesion.
- Recargar o cerrar la pestana pierde la sesion en el MVP.

## Efectos

El motor no ejecuta efectos. La UI reproduce audio y muestra una señal visual al cambiar de fase y al terminar. Fallar el audio no afecta al estado. Ninguna transicion escribe completions.
