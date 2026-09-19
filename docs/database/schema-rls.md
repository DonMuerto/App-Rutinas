# Esquema de datos y RLS

Este documento define el resultado requerido de las migraciones, no una migracion ejecutable.

## Tabla `routines`

| Columna | Regla |
|---|---|
| `id` | UUID, clave primaria, generado por base |
| `user_id` | UUID obligatorio hacia `auth.users`, borrado en cascada |
| `name` | Texto obligatorio y no vacio tras trim |
| `icon` | Texto opcional |
| `recurrence_type` | `daily` o `specific_date` |
| `specific_date` | Fecha obligatoria solo para `specific_date` |
| `content` | JSONB obligatorio, envelope version 1 por defecto |
| `position` | Entero no negativo para orden plano |
| `revision` | Entero grande no negativo, inicia en 0 y aumenta al guardar content |
| `created_at` | Timestamp con zona generado por servidor |
| `updated_at` | Timestamp con zona actualizado por servidor |

No existe `parent_id`. Deben existir indices para usuario+posicion, usuario+tipo de recurrencia y usuario+fecha especifica. Crear rutina usa RPC `security invoker` y lock para asignar posicion final sin colisiones. La migracion envuelve arrays historicos antes de exigir el envelope.

Crear una copia desde borrador usa `create_routine_from_draft`, tambien `security invoker` y bajo el mismo lock por usuario. Recibe una rutina origen, el envelope exacto, metadatos y un `request_id` UUID. Solo crea si el origen es visible bajo RLS, asigna `max(position) + 1`, persiste el documento en el insert con revision `0` y devuelve `NULL` tanto para un origen inexistente como ajeno.

## Guardado con revision

Una funcion `security invoker` recibe routine ID, revision esperada y documento. Actualiza solo cuando usuario y revision coinciden, incrementa revision, mantiene `updated_at` y devuelve la fila minima necesaria. Cero filas significa conflicto/inaccesible; el repositorio distingue conflicto solo para una rutina previamente cargada por el usuario.

## Tabla `block_completions`

| Columna | Regla |
|---|---|
| `id` | UUID obligatorio, clave primaria, `gen_random_uuid()` por defecto |
| `routine_id` | UUID obligatorio hacia rutina, borrado en cascada |
| `scope_activity_block_id` | Texto obligatorio, ID de la Activity que define el ambito |
| `block_id` | Texto obligatorio, Activity o checklist completado |
| `block_type` | Texto obligatorio con check `activity` o `checklist` |
| `completion_date` | Fecha obligatoria recibida de la aplicacion |
| `completed_at` | Timestamp con zona obligatorio generado por servidor |

Existe un constraint `UNIQUE` sobre rutina+ambito Activity+bloque+fecha; esa es la clave exacta de `ON CONFLICT`. `block_type` no forma parte de la identidad. Para `activity`, un check exige `scope_activity_block_id = block_id`. Para `checklist`, ambos IDs identifican propietario y objetivo. Repetir Marcar no cambia el `completed_at` original. La base no puede comprobar que esos IDs existan dentro del JSON; los repositorios solo aceptan IDs obtenidos del documento cargado.

Se requieren indices por rutina+fecha y por la clave logica.

## Reorder

Una funcion transaccional `security invoker` recibe la lista completa ordenada, rechaza duplicados o IDs ajenos/faltantes y actualiza posiciones contiguas. Se revoca ejecucion publica/anonima y se concede a `authenticated`. RLS sigue activa dentro de la operacion. Las pruebas fuerzan entradas invalidas y confirman que no existe actualizacion parcial.

## Idempotencia de copia de borrador

`routine_draft_copy_requests` conserva la relacion minima `user_id + request_id -> routine_id`. La clave primaria compuesta aisla la idempotencia por usuario. `routine_id` no tiene `ON DELETE CASCADE`: eliminar la copia no habilita reutilizar el request para crear otra rutina.

La tabla tiene RLS y no admite update ni delete desde Data API. `authenticated` recibe solo los grants que necesita la RPC `security invoker`; sus policies de select/insert exigen propietario y un contexto transaccional ligado al `request_id` que configura la propia RPC. Una consulta o insert directo no puede leer ni reservar claves. Usuario y resultado se escriben atomicamente con la rutina.

## RLS

RLS permanece habilitada en todas las tablas privadas.

| Operacion | `routines` | `block_completions` | `routine_draft_copy_requests` |
|---|---|---|---|
| Select | Solo `user_id = auth.uid()` | Solo si la rutina pertenece a `auth.uid()` | Solo propietario y request activo dentro de la RPC |
| Insert | `WITH CHECK` de propietario | `WITH CHECK` via rutina propietaria | Solo propietario y request activo dentro de la RPC |
| Update | `USING` y `WITH CHECK` de propietario | `USING` y `WITH CHECK` via rutina | Sin grant ni policy |
| Delete | Solo propietario | Solo via rutina propietaria | Sin grant ni policy |

El rol `authenticated` recibe grants explicitos necesarios para la Data API. `anon` no recibe acceso a datos privados. No se deshabilita RLS para corregir problemas de grants.

## Seguridad operativa

- El MVP usa URL y anon key publicas con sesion de usuario.
- No existe `SUPABASE_SERVICE_ROLE_KEY` en plantillas, runtime, CI ni deploy.
- No se crean funciones `security definer` sin un ADR y pruebas especificas.
- Las pruebas usan al menos usuario A, usuario B y rol anonimo.
- Usuario B no puede inferir si un ID de A existe.

## Integridad

- Eliminar una rutina elimina sus completions.
- Las combinaciones invalidas de recurrencia son rechazadas por constraint.
- Las claves unicas hacen idempotentes los reintentos.
- `updated_at` se mantiene en base y no depende de que cada cliente lo recuerde.
- `revision` evita sobrescritura silenciosa entre dispositivos; no implementa merge colaborativo.
- Las completions huerfanas por bloques eliminados se toleran y pueden limpiarse en una fase futura.
