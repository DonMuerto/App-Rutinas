# Contrato de dominio

## Entidades

| Entidad | Identidad | Fuente de verdad |
|---|---|---|
| Usuario | Identidad Supabase Auth | Supabase Auth |
| Rutina | UUID global | Fila `routines` |
| Bloque | ID estable dentro de una rutina | Documento BlockNote |
| Actividad | ID de bloque Activity | Contenido y props del bloque |
| Completion diaria | Rutina, ambito Activity, bloque y fecha | Fila `block_completions` |
| Borrador | Usuario + rutina | Draft journal local |
| Sesion de timer | Una por contexto de ejecucion | Snapshot local + engine puro |

## Rutina

- `name` es obligatorio, se recorta en los extremos y no puede quedar vacio.
- `icon` es opcional y decorativo.
- `recurrence` es diaria o de fecha especifica; ambos estados son excluyentes.
- `position` define un orden plano. No representa jerarquia.
- `content` es el documento BlockNote completo.
- `revision` aumenta en cada guardado de documento y detecta conflictos.
- Una rutina de fecha especifica permanece editable antes y despues de su fecha.

## Actividad

- Su titulo es el contenido inline del bloque, no una prop duplicada.
- Puede no tener hora.
- Puede no tener timer, tener countdown o intervalos.
- Su completion es diaria y externa al documento.
- Puede tener checklists descendientes como subtareas.
- No se permite crear una Activity dentro de otra Activity.

## Subtareas

Una checklist es subtarea cuando su ancestro Activity mas cercano existe. Puede estar a cualquier profundidad y puede haber texto u otros bloques entre ambos. Su texto y posicion pertenecen al documento; su check pertenece a `block_completions` para la fecha local.

Una checklist sin ancestro Activity conserva su `checked` nativo y persistente. Mover una checklist a traves del limite de una Activity cambia su regimen y el estado destino comienza desmarcado: no se convierte completion diaria en `checked` persistente ni a la inversa. Dentro de Activity, cualquier `checked` nativo previo se ignora y se normaliza a falso al persistir. Al moverla entre actividades, el nuevo ambito comienza sin completion salvo que ya exista una fila para esa combinacion exacta.

## Independencia de estados

- Completar una Activity no completa sus subtareas.
- Completar todas las subtareas no completa la Activity.
- Iniciar, cancelar o finalizar un timer no cambia completions.
- Editar una configuracion durante una sesion no cambia el snapshot en ejecucion.
- El estado `done` significa tiempo terminado, no trabajo completado.

## Identidades

- Editar, mover o indentar conserva IDs existentes.
- Insertar, pegar como copia o duplicar genera IDs nuevos para todos los bloques copiados.
- Un ID eliminado no se reutiliza intencionadamente.
- Las filas de completion huerfanas pueden conservarse; los lectores las ignoran.

## Borrador

Un draft contiene version de journal, user ID, routine ID, revision remota base, generacion monotona, document envelope, fecha local y timestamp absoluto. No es fuente remota. Nunca se aplica automaticamente sobre una revision distinta; el usuario resuelve el conflicto.

## Contexto de ejecucion

Web usa una pestana, Tauri una unica ventana y Capacitor un WebView. Cada contexto admite un timer. No se coordinan timers entre pestanas, ventanas, dispositivos ni instalaciones.
