# Contrato de repositorios

## Principios

- Solo el modulo de datos conoce Supabase y nombres de tablas.
- Las APIs publicas usan modelos de dominio, no filas generadas como contrato global.
- Toda fecha de negocio se recibe explicitamente.
- Las escrituras de metadatos, documento y completions estan separadas.
- Las mutaciones de completion son idempotentes.
- Los componentes no crean queries Supabase directas.
- Los repositorios usan Supabase JS en cliente y no dependen de Next.js ni cookies servidor.

## Rutinas

| Operacion | Regla |
|---|---|
| Listar | Metadatos ordenados, sin cargar `content` para el sidebar |
| Obtener | Rutina completa con revision accesible por ID |
| Crear | Nombre valido, recurrencia valida, documento vacio y posicion final |
| Crear desde borrador | Copia atomica e idempotente del documento exacto de una rutina accesible |
| Renombrar | Actualiza solo `name` |
| Cambiar recurrencia | Actualiza tipo y fecha como una unidad valida |
| Guardar documento | Recibe revision esperada, actualiza content y devuelve revision nueva |
| Reordenar | Ejecuta una operacion transaccional con la lista completa de IDs |
| Eliminar | Borra la rutina; completions caen por cascada |
| Listar para Hoy | Recibe fecha y devuelve diarias o especificas coincidentes con contenido |

Guardar documento usa compare-and-swap. Si la revision remota no coincide, devuelve conflicto sin sobrescribir. El draft local se conserva hasta guardar o descartar explicitamente.

## Completions

| Operacion | Regla |
|---|---|
| Leer | Por conjunto de rutinas y fecha explicita |
| Marcar | Upsert de una clave completa |
| Desmarcar | Delete idempotente de esa clave |

La identidad canonica y objetivo de upsert es `routine_id + scope_activity_block_id + block_id + completion_date`. `block_type` es un atributo validado, no parte de la identidad. Para una Activity, el ambito y el bloque objetivo son el mismo ID. Para una subtarea, el ambito es su Activity propietaria y el objetivo es el ID checklist.

## Reorder transaccional

El repositorio invoca una unica operacion Postgres `security invoker` que recibe la lista completa y sin duplicados de IDs en el orden deseado. Antes de actualizar valida que coincide exactamente con las rutinas del usuario autenticado. Toda posicion se actualiza en la misma transaccion o ninguna cambia. Solo `authenticated` puede ejecutarla y RLS permanece aplicable. No se permiten secuencias de updates independientes desde la UI.

Crear rutina tambien usa una operacion transaccional `security invoker` con lock para asignar la posicion final sin colisiones entre contextos concurrentes.

Crear desde borrador recibe `sourceRoutineId`, el `RoutineDocument` exacto, nombre, icono, recurrencia y un `requestId` UUID estable para el intento logico. La RPC verifica que la rutina origen pertenece al usuario autenticado sin distinguir entre un ID inexistente y uno ajeno, crea una unica rutina al final del sidebar con revision inicial `0`, y registra el resultado en la misma transaccion. Repetir `userId + requestId` devuelve el mismo ID y nunca crea otra fila; el documento inicial no pasa por un segundo guardado.

## Auth

El modulo publica initialize, registro, login, logout, refresh, suscripcion a auth y usuario requerido. Un guard React controla UX, pero no es frontera de seguridad. Un recurso ajeno se trata como inaccesible y RLS decide acceso.

Supabase recibe un storage adapter desde PlatformServices. El modulo no importa Tauri/Capacitor ni decide como se cifra el token.

## Errores

Los consumidores distinguen: no autenticado, no encontrado/inaccesible, validacion, `DOCUMENT_CONFLICT`, conflicto de timer, red, RLS y documento invalido. Los mensajes no exponen SQL ni existencia de datos ajenos.

## Cache

- Las claves incluyen usuario implicito por sesion, recurso y fecha cuando corresponda.
- Renombrar actualiza sidebar, cabecera y Hoy.
- Guardar contenido actualiza la rutina y obliga a refrescar su proyeccion de Hoy.
- Crear desde borrador usa las mismas invalidaciones de sidebar y Hoy que Crear.
- Completion actualiza editor y Hoy para la misma fecha.
- Al cruzar medianoche se usan claves nuevas; no se mutan datos del dia anterior.
- Todas las claves se segmentan por user ID y se eliminan al cambiar/logout de usuario.
- Resume revalida sesion y queries activas sin crear waterfalls innecesarios.
