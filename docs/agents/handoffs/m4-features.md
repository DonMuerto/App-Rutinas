# Handoff M4: shell, Hoy, completions y UI

## Identidad

- Sesion/rol: M4, features React y sistema visual.
- Ola/gate: Ola 1; implementacion portable lista para integracion M0.
- Owner receptor: M0 para composicion, M5 para E2E y smoke multiplataforma.
- Base commit y estado de worktree: checkpoint local `dd1677d5fb6079b4a8c528992dbb9f66ed7a1ef6`; worktree compartido con cambios concurrentes previos. M4 solo agrego archivos bajo `packages/features`, `packages/ui` y este handoff.

## Cambios

- Archivos creados/modificados: `packages/features/**` contiene contratos neutrales, adaptadores estructurales, auth UI, `CompletionStore`, observador de fecha local, `SessionExitCoordinator`, dialogo de salida, shell/sidebar, Hoy, fixtures, estilos responsive y pruebas; `packages/ui/**` contiene primitives, dialogo accesible, tema y pruebas.
- Ownership y transferencias: M4 posee `packages/features/**` y `packages/ui/**`. M0 debe conectar estos paquetes a `apps/client`, montar providers/rutas y cargar `@ritmo/ui/styles.css` y `@ritmo/features/styles.css`.
- Dependencias solicitadas a M0: agregar `@ritmo/features` y `@ritmo/ui` al cliente solo durante la composicion; conectar `AuthService`, repositorios, `DraftController`, `TimerController`, `QueryClient` y `NavigationPort` mediante los puertos/adaptadores publicados.
- Cambios concurrentes preservados: no se revirtieron ni modificaron archivos fuera de ownership.

## Contratos

- Documentos consumidos: `AGENTS.md`, vision/MVP, arquitectura multiplataforma, ADR 0002, contratos de plataforma/repositorios, modulo React, acceptance/testing, plan de ejecucion y handoffs M0/S1/S3/S4/S5.
- API publica entregada: `AppShell`, `Sidebar`, `AuthScreen`, `AuthForm`, `TodayView`, `CompletionStore`, `CompletionProvider`, hooks de completions/fecha, `LocalDateObserver`, `SessionExitCoordinator`, `SessionExitDialog`, `useSessionExitPrompt`, `ThemeProvider`, `ThemeToggle`, primitives UI y puertos de `packages/features/src/contracts.ts`.
- Adaptadores publicados: `createSidebarDataPort`, `createTodayDataSource`, `createTimerControllerPort` y `createQueryCachePort`; permiten consumir repositorios/proyector/timer reales sin importar SDKs de plataforma en features.
- Cambios propuestos: M2 debe exponer un facade de salida que implemente `DraftExitControllerPort` para `syncAll`, guardar copia y descarte; el `DraftController` actual publica primitivas de menor nivel y M0 debe decidir el adaptador/facade sin acoplarlo a UI.
- Supuestos: el timer pertenece a un contexto de ejecucion singleton y el controller se recrea al cambiar usuario; la navegacion usa rutas del `HashRouter`; `RoutineMetadata.name` es la fuente unica del titulo.

## Verificacion

- Tipos, lint, unitarias y build: `npm exec --yes pnpm@10.17.1 -- typecheck` pasa; `npm exec --yes pnpm@10.17.1 -- lint` pasa; Prettier dirigido a M4 pasa; `npm exec --yes pnpm@10.17.1 -- exec vitest run packages/features packages/ui` pasa con 17/17; suite global `npm exec --yes pnpm@10.17.1 -- test` pasa con 98/98; `npm exec --yes pnpm@10.17.1 -- build` pasa.
- RLS/E2E si aplica: M4 no modifica RLS ni posee `tests/e2e`; no existe suite E2E publicada en el worktree actual. M5 debe conectar la composicion integrada y probar flujos reales.
- Web/Tauri/Capacitor ejecutados: build Vite web ejecutado; Tauri y Capacitor no se ejecutaron en esta sesion.
- Plataformas no verificadas y motivo: Tauri requiere Rust/Windows SDK; Capacitor Android requiere Java/emulador; iOS requiere macOS/Xcode. La evidencia nativa queda para M5.
- Evidencia visual/dispositivo: pruebas de componentes cubren drawer, foco, Escape/back, reorder, Hoy, auth, tema y estados optimistas en jsdom. Responsive CSS contempla 360/768/1440, `100dvh`, safe areas, teclado y reduced motion; falta captura Chromium integrada.

## Riesgos

- Casos limite: rollback de completion y reorder, hidratacion obsoleta, aislamiento por usuario, medianoche/resume, timer ocupado, actividad sin ID/origen, estados loading/error/vacio, sesion expirada, drafts pendientes, cancelacion de logout, focus trap, retorno de foco y back Android.
- Limitaciones y bloqueos: M4 no puede montar rutas ni providers en `apps/client` por ownership M0; la integracion de DraftController requiere el facade indicado en cambios propuestos; las fixtures no representan persistencia Supabase real.
- Trabajo diferido: M0 integra paquetes y lazy-load del editor; M5 ejecuta E2E 360/768/1440, accesibilidad en navegador, RLS y smoke Tauri/Android.

## Confirmaciones

- Sin `any` injustificado ni secretos/service role.
- Sin RLS debilitada, XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Sin Activity separada del editor.
- Sin imports Tauri/Capacitor fuera de adaptadores.
- Sin Next/SSR nuevo en arquitectura objetivo.
- Sin modificaciones fuera de ownership no coordinadas.
