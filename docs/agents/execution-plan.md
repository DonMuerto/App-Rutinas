# Plan de ejecucion: migracion React multiplataforma

## Precondicion

El worktree contiene implementaciones Next no consolidadas. La primera accion M0 es inventariarlas, ejecutar pruebas posibles y crear un commit checkpoint local no destructivo antes de mover archivos. El handoff S2 faltante se sustituye por inventario tecnico y no bloquea. M0 no hace push ni descarta cambios.

## Seis sesiones

| ID | Rol | Ownership objetivo |
|---|---|---|
| M0 | Plataforma e integracion | Workspace, config, `apps/client`, `apps/desktop`, `apps/mobile`, `packages/core`, `packages/platform*` |
| M1 | Datos, auth y RLS | `packages/data-auth`, `supabase/migrations`, `supabase/tests` y unitarias propias |
| M2 | Documento, editor y Activity | `packages/document-model`, `packages/editor` |
| M3 | Timer y lifecycle | `packages/timer` |
| M4 | Shell, Hoy y completions | `packages/features`, `packages/ui` |
| M5 | Calidad y release | `tests` fuera de Supabase, workflows, ejecucion RLS y evidencia |

M0 es el unico owner de root package/lock/config y agrega dependencias solicitadas. Los demas no ejecutan generadores que alteren archivos compartidos.

## Olas

### Ola 0: M0 solo

Crear checkpoint local, workspace pnpm, Vite client, HashRouter, puertos y fakes, Tauri/Capacitor minimos, scripts y builds vacios. Migrar contratos/date utilities sin features. Eliminar Next solo despues de inventariar equivalencias.

Gate: tipos/lint/test/build Vite, Tauri check y Capacitor sync basico; handoff publicado.

### Ola 1: M1-M5 en paralelo

- M1 migra Supabase cliente, auth, schema revisionado y RLS.
- M2 separa document-model, migra BlockNote/Activity y crea draft journal.
- M3 migra engine/UI y añade storage/lifecycle restore.
- M4 migra shell/sidebar/Hoy/completions sobre ports y fixtures.
- M5 prepara fixtures, ejecuta suites RLS de M1, E2E web y harness native.

Handoffs parciales: M1 repositorios/auth; M2 proyector/editor API; M3 timer controller; M4 composition requirements; M5 hallazgos por owner.

### Ola 2: integracion M0

Componer providers, rutas lazy y adaptadores reales. Resolver imports Next restantes y duplicacion de stores. Defectos internos vuelven al owner.

### Ola 3: endurecimiento

M2 valida WebViews; M0 valida shells; M5 ejecuta matriz. M1 cierra RLS dinamico. M3 prueba restore/background. M4 cierra responsive/back/accessibility.

## Dependencias

```text
M0 ports/scaffold -> M1, M2, M3, M4, M5
M1 repositorios/auth -> M2, M4
M2 document-model/proyector -> M4
M3 timer API -> M2, M4
M1-M4 -> M5
M0 integra handoffs
```

## Reglas

- Los handoffs historicos existentes S0, S1, S3, S4 y S5 se conservan; M0 inventaria el codigo S2 sin handoff. El plan M0-M5 los supersede.
- No reescribir toda la app desde cero si el modulo actual es portable.
- No mantener dos implementaciones activas tras cerrar migracion.
- Cambios de contrato se documentan antes de expandirse.
- Un target no ejecutado se declara no verificado.
