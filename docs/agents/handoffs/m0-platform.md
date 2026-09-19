# Handoff M0: plataforma React e integracion

## Identidad

- Sesion/rol: M0, plataforma e integracion.
- Ola/gate: Olas 0 y 2 completadas; endurecimiento local de Ola 3 ejecutado hasta los limites del entorno.
- Owner receptor: M5 para matriz final, M1 para RLS dinamico y runners nativos para smoke Tauri/Android.
- Base commit y estado de worktree: checkpoint local `dd1677d5fb6079b4a8c528992dbb9f66ed7a1ef6` (`chore: checkpoint Next implementation before Vite migration`), sin push. La migracion React/Vite y la integracion M1-M4 permanecen sin commit; el branch esta un commit por delante de `origin/main`.

## Cambios

- Archivos creados/modificados: workspace pnpm, configuracion Vite/TypeScript/ESLint/Vitest/Playwright/Prettier, `apps/client`, `apps/desktop`, `apps/mobile`, `packages/core`, `packages/platform*`, `packages/data-auth`, `packages/document-model`, `packages/editor`, `packages/timer`, `packages/features`, `packages/ui`, migraciones/pruebas Supabase, E2E, smoke nativo, workflow y lockfile.
- Composicion entregada: bootstrap de plataforma y Supabase, QueryClient, tema, HashRouter, guard auth, recursos aislados por usuario, shell/sidebar, Hoy, completions, timer, editor BlockNote lazy, drafts, conflictos, session exit y error boundaries de aplicacion/ruta.
- Integracion de datos: `RoutineRepository.createFromDraft` usa la RPC idempotente `create_routine_from_draft`; la migracion `20260918130000_create_routine_from_draft.sql` agrega ledger privado con RLS y conserva el documento exacto con revision inicial `0`.
- Endurecimiento: drafts usan CAS y UUID v8 determinista para copias; logout elimina credenciales aun ante fallo remoto; completions propagan abort; cache se limpia por usuario; timer no sobrescribe una restauracion fallida; metadata revierte mutaciones rechazadas; conflictos dejan el editor read-only.
- Lifecycle: suscripciones con prioridad ordenan dialogo de salida, drawer, proteccion local y navegacion. Back protege primero el draft y dispara flush remoto sin bloquear indefinidamente la navegacion; un fallo de DraftStorage si bloquea salida.
- Routing y resiliencia: `vite.base` es relativo, no se sintetiza Back desde `popstate`, el handler nativo de Capacitor permanece activo y los error boundaries aislan una ruta pesada sin destruir los recursos/drafts del usuario.
- Dependencias: manifests y `pnpm-lock.yaml` incluyen React 19, Vite 8, Tauri 2.11, Capacitor 8.5, React Router 7, TanStack Query, Supabase JS, BlockNote base y secure storage 8. No se agregaron paquetes BlockNote XL.
- Cambios concurrentes preservados: no se revirtieron cambios ajenos. El arbol Next previo permanece recuperable en el checkpoint autorizado; no hay dos implementaciones activas en el worktree actual.

## Contratos

- Documentos consumidos: `AGENTS.md`, producto/MVP, arquitectura/ADR 0002, contratos de plataforma/repositorios/documento/timer, esquema RLS, modulos React/editor/timer/Hoy/shell, aceptacion, testing y plan de ejecucion.
- API publica entregada: `PlatformServices` y adaptadores por target; `LifecyclePort.subscribe(listener, { priority })`; repositorios/auth; `DraftController`; `TimerController`; stores/adaptadores de completions, Hoy y session exit.
- Bootstrap entregado: deteccion de runtime e imports dinamicos solo en `apps/client/src/bootstrap.ts`; un unico `dist/` alimenta web, `frontendDist` de Tauri y `webDir` de Capacitor.
- Configuracion requerida: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Si faltan, el cliente muestra un error de configuracion y no intenta abrir rutas privadas.
- Cambios documentales: contratos de plataforma, repositorios y esquema RLS fueron actualizados antes de consumir prioridad lifecycle y copia idempotente.
- Supuestos: web acepta `localStorage` para sesion segun el threat model documentado; drafts y timer usan IndexedDB separado y claves por usuario/contexto. La RPC se ejecuta como invoker y RLS sigue siendo la frontera de seguridad.

## Verificacion

- Tipos, lint, formato, unitarias y build: `typecheck`, `lint` y `format` pasan; 26 archivos y 127 pruebas unitarias pasan; build Vite pasa con 2951 modulos. BlockNote permanece en `routine-route-*.js/css`, separado del chunk inicial.
- Build: existe warning no bloqueante por chunks minificados mayores a 500 kB (`src` y `routine-route`); el editor pesado ya esta lazy y no retrasa el arranque inicial.
- RLS/E2E: 7 invariantes estaticas de migraciones pasan; la prueba RLS dinamica queda omitida por falta de Supabase local/contenedores. Playwright pasa 12/12 en Chromium desktop/mobile y viewports 360/768/1440; valida bootstrap real, guard privado, recarga HashRouter, auth local sin red, ausencia de errores y ausencia de Service Worker.
- Web/Tauri/Capacitor: build web y `cap sync` pasan para Android/iOS usando el `dist/` final; los assets Vite de Android coinciden byte a byte con `dist/`, excluyendo solo los dos bridges Cordova generados por Capacitor. `tauri info` parsea app/CSP/capabilities, detecta WebView2 153 y las versiones JS de Tauri/opener.
- Plataformas no verificadas: Tauri build/runtime bloqueado por falta de Rust, Cargo, MSVC y Windows SDK. Android runtime/emulador no se ejecuto en esta maquina. iOS/macOS no se aprueban sin macOS/Xcode.
- Evidencia visual/dispositivo: responsive web automatizado en 360/768/1440. No hubo smoke manual de BlockNote en WebView2, Android WebView o WKWebView.
- Particularidad del entorno: `pnpm` se ejecuto mediante `npm exec --yes pnpm@10.17.1 -- <script>`; existen procesos Vite locales previos en 5173/4173, por lo que Playwright usa un servidor aislado en 4273 y nunca reutiliza uno existente.

## Riesgos

- Casos limite cubiertos: concurrencia de drafts, autosave/restauracion, conflicto remoto, copia idempotente, logout/expiracion, timer restore/background, completion optimista, prioridades Back, errores de ruta y cambio de rutina con conflicto anterior.
- Limitaciones y bloqueos: A-03 requiere ejecutar la suite RLS A/B/anon contra Supabase local; B-08, E-03, G-02 y G-05 requieren runners/dispositivos nativos. A-01 completo requiere credenciales/configuracion Supabase real en los tres targets.
- Cobertura E2E diferida: el smoke integrado cubre acceso no autenticado. Auth real, CRUD/editor, conflicto, Hoy, timer y logout estan cubiertos por unitarias de modulo, pero aun no por un E2E autenticado de producto.
- Rendimiento diferido: el chunk lazy del editor ronda 937 kB minificado y debe observarse en dispositivos de gama baja; no bloquea el chunk inicial.
- Trabajo diferido: ejecutar RLS dinamico en CI/local Supabase, Tauri Windows y Android smoke; realizar matriz manual BlockNote/touch/IME/clipboard; ampliar Playwright con fixtures autenticados cuando exista un entorno Supabase de prueba.

## Confirmaciones

- Sin `any` injustificado, secretos, service role ni credenciales privadas en bundle/CI/runtime.
- Sin RLS debilitada, paquetes XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Sin Activity separada del editor; Activity se crea y edita dentro de BlockNote.
- Sin imports Tauri/Capacitor fuera de adaptadores; el bootstrap solo selecciona el adaptador mediante imports dinamicos.
- Sin Next, `@supabase/ssr`, RSC, Server Actions, React Native o Expo en la arquitectura activa.
- Las eliminaciones del arbol Next fueron autorizadas y permanecen preservadas en el checkpoint local.
