# Arquitectura

## Fronteras

| Modulo | Responsabilidad | No debe hacer |
|---|---|---|
| Shell | Layout, navegacion, tema y montaje del timer global | Interpretar JSON BlockNote |
| Auth/datos | Sesion, Supabase, RLS y repositorios | Renderizar features del editor |
| Rutinas/editor | Metadatos, BlockNote, autosave y esquema custom | Consultar todas las rutinas para Hoy |
| Actividad | Render inline, validacion y comandos | Implementar motor, SQL o vista Hoy |
| Completados | Estado diario idempotente | Alterar contenido editorial |
| Proyector | Extraer actividades y subtareas de documentos | Escribir documentos o completados |
| Hoy | Agregar, ordenar, completar, iniciar y navegar | Editar documentos |
| Timer engine | Plan y transiciones puras por timestamps | Conocer React, DOM, audio o Supabase |
| Timer UI | Singleton global, overlay, audio y accesibilidad | Completar actividades |

## Dependencias permitidas

```text
Shell -> Auth, Sidebar, Timer UI
Sidebar -> Repositorio de rutinas
Editor -> Repositorio de rutinas, Esquema documental, Actividad, Completados, Timer UI
Hoy -> Repositorio de rutinas, Proyector, Completados, Timer UI
Proyector -> Esquema documental
Actividad -> Contrato de timer, Completados, Timer UI
Timer UI -> Timer engine
Repositorios -> Supabase y sesion
```

Las dependencias inversas o accesos directos a tablas desde componentes quedan prohibidos.

## Fuentes de verdad

| Dato | Fuente |
|---|---|
| Titulo de rutina | `routines.name` |
| Documento y estructura | `routines.content` |
| Titulo de actividad | Contenido inline del bloque Activity |
| Configuracion de timer | Props del bloque Activity |
| Completion de actividad | Estado diario relacional |
| Completion de subtarea Activity | Estado diario relacional |
| Checklist normal | Propiedad persistida del bloque |
| Fecha de negocio | Navegador |
| Timer activo | Store global en memoria de la pestana |

## Flujos criticos

### Guardado

Renombrar solo actualiza `name`; guardar el editor solo actualiza `content`; cambiar recurrencia solo actualiza sus campos. Nunca se envia una fila completa desde estado posiblemente desactualizado. El autosave usa debounce, conserva cambios locales ante error y muestra su estado.

### Hoy

El navegador produce una fecha local. El repositorio recupera rutinas elegibles y completados de esa fecha. El proyector recorre los documentos y Hoy ordena la salida. Hoy nunca guarda `content`.

### Timer

Activity o Hoy entregan un snapshot validado al runtime global. El motor calcula fases mediante deadlines. La UI representa transiciones y audio. La sesion persiste durante navegacion cliente, pero no tras recarga.

## Decisiones de implementacion diferidas

- Versiones exactas se fijan al crear el scaffold y se registran en el handoff de plataforma.
- La tecnica concreta para superponer completados diarios sobre checklists BlockNote requiere un spike antes de integrar el editor.
- La API exacta para enfocar un bloque por ID requiere un spike BlockNote.
- La colaboracion concurrente y versionado de documentos quedan fuera del MVP.
