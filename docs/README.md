# Documentacion de Ritmo

Especificacion vigente para una aplicacion React/Vite compartida entre web, Tauri y Capacitor. Los handoffs historicos existentes S0, S1, S3, S4 y S5 describen Next.js; falta S2 y ninguno define la arquitectura futura.

## Lectura comun

| Documento | Proposito |
|---|---|
| [Vision](product/vision.md) | Problema, experiencia y principios del producto |
| [Alcance MVP](product/mvp-scope.md) | Incluido, excluido y recorridos principales |
| [Arquitectura](architecture/overview.md) | Modulos, dependencias y flujo de datos |
| [React multiplataforma](architecture/react-multiplatform.md) | Workspace, puertos y composicion React |
| [Decisiones iniciales](architecture/decisions/0001-mvp-decisions.md) | Decisiones de producto que siguen vigentes |
| [ADR multiplataforma](architecture/decisions/0002-react-vite-tauri-capacitor.md) | Enmienda tecnologica vigente |
| [Plan de ejecucion](agents/execution-plan.md) | Sesiones, olas, ownership y gates |
| [Aceptacion](quality/acceptance.md) | Definicion verificable de terminado |

## Contratos compartidos

| Documento | Consumidores principales |
|---|---|
| [Dominio](contracts/domain.md) | Todos los modulos |
| [Documento BlockNote](contracts/document-schema.md) | Editor, Actividad, Hoy y calidad |
| [Temporizador](contracts/timer.md) | Actividad, motor, UI y Hoy |
| [Repositorios](contracts/repositories.md) | Datos, editor, sidebar y Hoy |
| [Proyeccion de actividades](contracts/activity-projection.md) | Editor, Hoy y calidad |
| [Plataforma](contracts/platform.md) | Lifecycle, storage, routing y shells |
| [Esquema y RLS](database/schema-rls.md) | Datos y calidad |
| [Semantica temporal](database/time-semantics.md) | Datos, completados, timer y Hoy |

## Especificaciones de modulo

| Modulo | Documento |
|---|---|
| Auth y acceso a datos | [auth-data.md](modules/auth-data.md) |
| Rutinas y editor | [routines-editor.md](modules/routines-editor.md) |
| Bloque Actividad | [activity-block.md](modules/activity-block.md) |
| Completados diarios | [completions.md](modules/completions.md) |
| Motor temporal | [timer-engine.md](modules/timer-engine.md) |
| Runtime y UI temporal | [timer-ui.md](modules/timer-ui.md) |
| Vista Hoy | [today.md](modules/today.md) |
| Shell, sidebar y diseno | [shell-sidebar-design.md](modules/shell-sidebar-design.md) |
| Aplicacion React | [react-application.md](modules/react-application.md) |
| Shells nativos | [platform-shells.md](modules/platform-shells.md) |

## Coordinacion

- [Plan multiagente](agents/execution-plan.md)
- [Plantilla de handoff](agents/handoff-template.md)
- [Roles y prompts](agents/roles/README.md)
- [Estrategia de pruebas](quality/testing.md)
- [Despliegue](operations/deployment.md)

## Regla de cambios

Un agente puede corregir detalles internos de su modulo. Cambiar formato persistido, API publica, plataforma, ownership, fecha, timer o comportamiento visible requiere propuesta al coordinador y actualizacion previa del contrato.
