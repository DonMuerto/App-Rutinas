# Contrato de repositorios

## Principios

- Solo el modulo de datos conoce Supabase y nombres de tablas.
- Las APIs publicas usan modelos de dominio, no filas generadas como contrato global.
- Toda fecha de negocio se recibe explicitamente.
- Las escrituras de metadatos, documento y completions estan separadas.
- Las mutaciones de completion son idempotentes.
- Los componentes no crean queries Supabase directas.

## Rutinas

| Operacion | Regla |
|---|---|
| Listar | Metadatos ordenados, sin cargar `content` para el sidebar |
| Obtener | Rutina completa accesible por ID |
| Crear | Nombre valido, recurrencia valida, documento vacio y posicion final |
| Renombrar | Actualiza solo `name` |
| Cambiar recurrencia | Actualiza tipo y fecha como una unidad valida |
| Guardar documento | Actualiza solo `content` y auditoria |
| Reordenar | Ejecuta una operacion transaccional con la lista completa de IDs |
| Eliminar | Borra la rutina; completions caen por cascada |
| Listar para Hoy | Recibe fecha y devuelve diarias o especificas coincidentes con contenido |

El MVP acepta ultima escritura para concurrencia de documento. El estado local no debe presentarse como guardado si fallo la persistencia.

## Completions

| Operacion | Regla |
|---|---|
| Leer | Por conjunto de rutinas y fecha explicita |
| Marcar | Upsert de una clave completa |
| Desmarcar | Delete idempotente de esa clave |

La identidad canonica y objetivo de upsert es `routine_id + scope_activity_block_id + block_id + completion_date`. `block_type` es un atributo validado, no parte de la identidad. Para una Activity, el ambito y el bloque objetivo son el mismo ID. Para una subtarea, el ambito es su Activity propietaria y el objetivo es el ID checklist.

## Reorder transaccional

El repositorio invoca una unica operacion Postgres `security invoker` que recibe la lista completa y sin duplicados de IDs en el orden deseado. Antes de actualizar valida que coincide exactamente con las rutinas del usuario autenticado. Toda posicion se actualiza en la misma transaccion o ninguna cambia. Solo `authenticated` puede ejecutarla y RLS permanece aplicable. No se permiten secuencias de updates independientes desde la UI.

## Auth

El modulo publica operaciones de registro, login, logout, restauracion y usuario requerido. Un recurso ajeno se trata como inaccesible. Middleware o redireccion visual no sustituyen la validacion de sesion ni RLS.

## Errores

Los consumidores deben distinguir: no autenticado, no encontrado/inaccesible, validacion, conflicto de timer, red, RLS y documento invalido. Los mensajes para usuario no exponen detalles SQL ni existencia de datos ajenos.

## Cache

- Las claves incluyen usuario implicito por sesion, recurso y fecha cuando corresponda.
- Renombrar actualiza sidebar, cabecera y Hoy.
- Guardar contenido actualiza la rutina y obliga a refrescar su proyeccion de Hoy.
- Completion actualiza editor y Hoy para la misma fecha.
- Al cruzar medianoche se usan claves nuevas; no se mutan datos del dia anterior.
