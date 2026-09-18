# Modulo de completados diarios

## Objetivo

Gestionar el estado manual por fecha de Activities y checklists descendientes sin modificar la definicion permanente del documento.

## Claves

Cada operacion recibe `routineId`, `scopeActivityBlockId`, `blockId`, `blockType` y `localDate`. Una Activity se identifica usando su mismo ID como ambito y objetivo. Una checklist usa el ID de su Activity propietaria como ambito.

## Flujos

### Marcar

1. Capturar la fecha local actual.
2. Aplicar UI optimista.
3. Hacer upsert idempotente.
4. Confirmar o revertir con mensaje accesible.

### Desmarcar

1. Capturar la fecha local actual.
2. Aplicar UI optimista.
3. Eliminar la clave exacta.
4. Considerar exito si ya no existia.
5. Revertir ante fallo real.

### Cambio de dia

No se borran filas. Al cruzar medianoche o recibir resume se calcula otra fecha y query key. La ausencia equivale a incompleto.

## Reglas

- Completion de Activity y subtareas son independientes.
- Timer y completion no se invocan entre si.
- Editor y Hoy observan la misma cache para una fecha.
- Checklists normales no consumen este modulo.
- Filas huerfanas se ignoran.
- Mover una checklist a otra Activity cambia su ambito y no hereda automaticamente completion.
- Existe una unica cache/store por usuario y contexto compartida por editor y Hoy.
- Logout/cambio de usuario cancela mutaciones y limpia estado en memoria.

## Accesibilidad y error

Los controles exponen estado checked y pendiente. Un rollback se anuncia sin mover el foco. La UI no debe quedar bloqueada indefinidamente. Los detalles de RLS permanecen fuera del mensaje de usuario.

## Aceptacion del modulo

- Repetir marcar no duplica filas.
- Desmarcar inexistente converge a incompleto.
- Cambiar de fecha muestra estado independiente.
- Dos Activities con checklists de igual texto no comparten estado.
- Hoy y editor convergen tras mutacion.
- Terminar o cancelar un timer no escribe filas.

## Handoff

Entregar hooks React sobre repositorios, optimistic update, rollback y observador basado en LifecyclePort. No crear Supabase directo ni stores separados por pantalla.
