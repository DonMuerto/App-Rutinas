# Contrato de proyeccion de actividades

## Objetivo

Transformar rutinas y documentos en un read model de solo lectura para Hoy. La proyeccion es pura, no se persiste, no modifica el documento y no importa React, BlockNote ni APIs de plataforma.

## Entrada

- Metadatos de rutina, incluido `name`, `icon` y `position`.
- Documento conforme al contrato BlockNote.
- Completion de bloques para una fecha concreta.
- Identidad opcional del timer global.

La seleccion de rutinas por fecha ocurre antes de proyectar.

## Salida por Activity

| Dato | Fuente |
|---|---|
| Rutina y nombre | Fila de rutina |
| Activity ID | ID del bloque |
| Titulo plano | Contenido inline visible |
| Hora | Prop validada |
| Timer | Configuracion normalizada o error |
| Completion | Registro diario de Activity |
| Subtareas | Checklists descendientes en orden |
| Profundidad | Relativa a la Activity |
| Enlace de origen | Rutina y Activity ID |
| Orden documental | Recorrido estable del documento |

## Recorrido

- Recorrer en profundidad respetando el orden de bloques.
- Emitir una fila por Activity.
- Asociar una checklist al ancestro Activity mas cercano.
- Una Activity invalida delimita igualmente su ambito para evitar asignaciones ambiguas.
- Texto y otros bloques intermedios no rompen la descendencia.
- Los registros huerfanos se ignoran.

## Orden de Hoy

1. Actividades con hora valida antes que actividades sin hora.
2. Hora ascendente.
3. Posicion de rutina.
4. Orden documental.
5. `routineId` y despues Activity ID como desempate estable global.

## Tolerancia

Un documento parcialmente invalido no bloquea otras rutinas ni otros bloques validos. Una Activity invalida sigue visible, con Start deshabilitado. La proyeccion devuelve diagnosticos para observabilidad y pruebas, pero no corrige el documento.

## Navegacion

El origen se representa con `routineId` y `activityBlockId`. La ruta abre la rutina y solicita foco/scroll al bloque una vez inicializado BlockNote. Si el bloque ya no existe, se abre la rutina y se informa sin romper la pagina.

El href concreto lo construye NavigationPort; la proyeccion no conoce hash router, protocolo Tauri ni esquema Capacitor.
