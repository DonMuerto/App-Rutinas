# Handoff S5: shell, sidebar y diseno

> Handoff historico Next.js. La UI es material de migracion; app shell, tema y routing se rigen por ADR 0002 y M4.

## Identidad

- Sesion: S5.
- Rol: shell, sidebar y sistema visual.
- Alcance terminado: shell privado responsive, tema claro/oscuro, sidebar plano, drawer movil, navegacion, creacion y reorder accesible.
- Owner receptor: S0 para integracion; S1/S2/S3/S4 para consumo de fronteras.
- Ola/gate: Ola 1 fundaciones y conexion vertical disponible; pendiente del gate global.

## Cambios

- Archivos creados: `app/(app)/layout.tsx`; `components/shell/**`; `components/sidebar/**`; `components/theme/**`; `components/ui/**`; `components/sidebar/sidebar.test.tsx`.
- Archivos modificados: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`.
- Archivos compartidos tocados con autorizacion: `app/layout.tsx`, `app/page.tsx` y `app/globals.css`, transferidos por S0 como scaffold temporal.
- Dependencias solicitadas o agregadas por S0: ninguna. Se consumen `next-themes`, `@dnd-kit/*`, `lucide-react` y los providers ya publicados por S0/S1/S3.

## Contratos

- Contratos consumidos: `docs/contracts/domain.md`, `docs/contracts/repositories.md`, `docs/contracts/timer.md`, `docs/modules/shell-sidebar-design.md`, `docs/modules/timer-ui.md`, `docs/quality/acceptance.md`, `docs/quality/testing.md` y `docs/agents/execution-plan.md`.
- API publica entregada: `AppShell`, `PrivateShell`, `LiveShell`, `Sidebar`, `SidebarDataProps`, `ThemeProvider`, `ThemeToggle`, `Button` e `IconButton`.
- Integracion publicada: el layout servidor carga `RoutineMetadata` mediante `createServerRepositories`, monta `QueryProvider` y `TimerProvider`, y `LiveShell` usa `createBrowserRepositories` para crear y reordenar sin consultas Supabase desde componentes.
- Cambios de contrato propuestos: ninguno.
- Supuestos adoptados: la API de S1 devuelve `Routine` al crear y expone `routines.create`, `routines.reorder` y `listMetadata`; `ShellFixture` solo queda como soporte de scaffold y pruebas visuales locales.

## Verificacion

- Comandos ejecutados: `npm exec --yes pnpm@10.17.1 -- typecheck`; lint dirigido a archivos S5; `npm exec --yes pnpm@10.17.1 -- exec vitest run components/sidebar/sidebar.test.tsx`; `npm exec --yes pnpm@10.17.1 -- test`; `npm exec --yes pnpm@10.17.1 -- build`; Prettier dirigido a archivos S5.
- Resultado de tipos: los archivos S5 pasan lint y compilacion dirigida; el `typecheck` global mas reciente queda bloqueado por `components/editor/routine-editor-screen.tsx:166` (`useRef` sin argumento inicial) y `components/editor/routine-editor-screen.tsx:253` (asignacion `undefined`), ambos fuera del ownership de S5.
- Resultado de lint: archivos S5 pasan sin errores ni warnings. El lint global queda bloqueado por errores preexistentes/concurrentes en editor y por warnings en `.agents/skills`.
- Resultado de pruebas del modulo: 4 pruebas S5 aprobadas: lista plana, metadata, reorder optimista con rollback, creacion/navegacion y Escape del drawer.
- Resultado de build: una corrida completa anterior paso y genero `/`, `/hoy`, `/login`, `/registro` y `/rutinas/[routineId]`; la corrida mas reciente no supera TypeScript por los mismos dos errores concurrentes de `components/editor/routine-editor-screen.tsx`.
- Evidencia adicional RLS/E2E/visual: CSS responsive cubre menos de 768 px, 768 px o mas y viewport minimo de 360 px; tokens definidos para los colores contractuales, foco visible y `prefers-reduced-motion`. No se modificaron pruebas RLS ni E2E, que pertenecen a S6.

## Riesgos

- Casos limite cubiertos: drawer cerrado inicialmente, Escape y retorno de foco, cierre al navegar, sidebar colapsable, lista vacia/carga/error/sesion expirada, nombres vacios, reorder por botones arriba/abajo, reorder optimista, rollback de red y tema sin mismatch de hidratacion.
- Limitaciones conocidas: el gate global de lint tiene errores en `components/editor/**` y warnings en `.agents/skills`; el typecheck/build actuales quedan bloqueados por `components/editor/routine-editor-screen.tsx`; el test global actual tiene un fallo concurrente en `components/editor/blocknote-spikes.test.tsx`. No pertenecen a S5. La evidencia visual automatizada de Chromium queda para S6.
- Trabajo diferido: eliminar `ShellFixture` al cerrar integracion de datos si S0 no lo necesita; precarga de metadatos con cache TanStack Query queda bajo la estrategia de S1.
- Bloqueos para consumidores: ninguno para las APIs de shell. S0 debe conservar `QueryProvider` y `TimerProvider` por encima del shell; S1 debe mantener las firmas publicas de repositorio usadas por `LiveShell`.

## Confirmaciones obligatorias

- No se uso `any` injustificado.
- No se introdujo `SUPABASE_SERVICE_ROLE_KEY`.
- No se debilito RLS.
- No se agregaron paquetes `@blocknote/xl-*`.
- No se implemento PWA, Service Worker, Web Notifications o Wake Lock.
- No se creo una pantalla de edicion de Activity.
- No se modificaron archivos fuera del ownership sin coordinacion.
