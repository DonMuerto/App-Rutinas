# Handoff S4: Hoy y completions

> Handoff historico Next.js. La migracion vigente corresponde a M4 y a los contratos multiplataforma.

## Identidad

- Sesion: S4
- Rol: Vista Hoy y completions diarias
- Alcance terminado: Cache optimista, observador de fecha local, agregacion real de Hoy, UI read-only, completions, timer y navegacion al origen.
- Owner receptor: S0 integracion y S6 calidad
- Ola/gate: Olas 1 y 2; pendiente gate global por fallos ajenos descritos abajo.

## Cambios

- Archivos creados: `lib/completions/**`, `lib/today/**`, `components/today/**`, `app/(app)/hoy/page.tsx`.
- Archivos modificados: ninguno fuera del ownership de S4.
- Archivos compartidos tocados con autorizacion: este handoff obligatorio.
- Dependencias solicitadas o agregadas por S0: ninguna.

## Contratos

- Contratos consumidos: dominio, completions, repositorios, proyeccion de actividades, documento, timer, fecha local, Today, timer UI y ADR 0001.
- API publica entregada: `CompletionStore`, `CompletionProvider`, `useCompletionState`, `useCompletionAnnouncement`, `LocalDateObserver`, `useObservedLocalDate`, `RepositoryTodayDataSource`, `TodayView` y `TodayScreen`.
- Cambios de contrato propuestos: ninguno.
- Supuestos adoptados: la navegacion al origen usa el parametro `activity` publicado por la ruta de S2; el `TimerProvider` singleton esta montado sobre las rutas privadas por S5.

## Verificacion

- Comandos ejecutados: `pnpm exec vitest run lib/completions lib/today components/today`; `pnpm test`; `pnpm exec eslint "app/(app)/hoy/page.tsx" components/today lib/completions lib/today --max-warnings=0`; `pnpm typecheck`; `pnpm lint`; `pnpm build`; `git diff --check`.
- Resultado de tipos: S4 y el repositorio pasan con `tsc --noEmit --target es2018`. El comando oficial falla porque `supabase/migration.test.ts` usa regex con flag `s` mientras `tsconfig.json` conserva target ES2017.
- Resultado de lint: rutas de S4 pasan sin warnings. El lint global falla en `.agents/**` y archivos de editor de S2; S4 no modifico esos owners.
- Resultado de pruebas del modulo: 19/19 pasan.
- Resultado de build: una ejecucion compilo Next y llego a TypeScript; la ultima reejecucion encontro otro proceso `next build` concurrente. El gate no cierra todavia por trabajo concurrente fuera de S4.
- Evidencia adicional RLS/E2E/visual: suite global 90/90 pasa, con 1 prueba RLS local omitida por falta de entorno; S4 cubre UI read-only, rollback accesible, error total/parcial, vacio, ID ausente, singleton, orden, medianoche, visibilidad y cambio de zona.

## Riesgos

- Casos limite cubiertos: orden estable; actividades con/sin hora; documento parcialmente invalido; Activity o checklist sin ID; carga, vacio y error; mutacion duplicada pendiente; rollback; lectura obsoleta concurrente; fechas independientes; medianoche; recuperacion de visibilidad; cambio de zona; timer ocupado.
- Limitaciones conocidas: las pruebas RLS y E2E completas pertenecen a S6 y requieren su harness/entorno; no se realizo captura visual con navegador en esta sesion.
- Trabajo diferido: S6 debe validar responsive a 360/768/1440, navegacion completa y sincronizacion editor/Hoy contra Supabase local.
- Bloqueos para consumidores: ninguno en las APIs de S4.

## Confirmaciones obligatorias

- No se uso `any` injustificado.
- No se introdujo `SUPABASE_SERVICE_ROLE_KEY`.
- No se debilito RLS.
- No se agregaron paquetes `@blocknote/xl-*`.
- No se implemento PWA, Service Worker, Web Notifications o Wake Lock.
- No se creo una pantalla de edicion de Activity.
- No se modificaron archivos fuera del ownership sin coordinacion, salvo este handoff exigido por `AGENTS.md`.
