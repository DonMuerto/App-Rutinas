# Handoff M2: documento, editor y Activity

## Identidad

- Sesion/rol: M2, documento, editor y Activity.
- Ola/gate: Ola 1, modulo portable listo para integracion; quedan bloqueos externos detallados abajo.
- Owner receptor: M0 para rutas/providers y adaptadores M1; M4 para `DraftExitAdapter`, completions y timer; M5 para E2E y smoke nativo.
- Base commit y estado de worktree: checkpoint local `dd1677d5fb6079b4a8c528992dbb9f66ed7a1ef6`; migracion M0-M4 concurrente, sin commit y preservada.

## Cambios

- Archivos creados/modificados: `packages/document-model/**`, `packages/editor/**` y este handoff.
- Ownership y transferencias: `packages/document-model` entrega envelope, inspeccion/recovery, serializacion, Activity y proyeccion; `packages/editor` entrega BlockNote React y `DraftController`.
- Cambios coordinados fuera de ownership: `packages/core/src/routines.ts` adopta `RoutineDocument` v1 y elimina el sentinel persistido `scheduledTime: ""`; `packages/platform/src/types.ts`, `fakes.ts`, `index.ts` y `packages/platform-web/src/indexed-db.ts` entregan storage revisionado con CAS atomico. Fueron autorizados expresamente por el coordinador.
- Dependencias solicitadas a M0: BlockNote base `0.54.2`, Mantine `8.3.11`, Lucide `1.45.0`, React/React DOM `19.1.1` y tipos asociados quedaron fijados en manifests/lock. React raiz se fijo a `19.1.1` para que Vitest no cargue `react-dom 19.3` junto al runtime del cliente.
- Cambios concurrentes preservados: no se modifico `packages/features` ni `packages/data-auth`; se consumieron sus contratos publicados durante la sesion. El arbol Next eliminado sigue preservado en el checkpoint.

## Contratos

- Documentos consumidos: `AGENTS.md`, vision/MVP, arquitectura/ADR 0002, contratos de documento/plataforma/repositorios, modulos de editor/timer/Hoy/shell, aceptacion, testing, plan M2 y handoffs M0/M1.
- API publica `@ritmo/document-model`: migracion one-shot de arrays al envelope `{ schemaVersion: 1, blocks }`, inspeccion editable/recovery, diagnosticos, serializacion sin mutacion, normalizacion de checklist Activity, scopes, texto inline, validacion/duracion Activity y proyeccion/orden estable para Hoy.
- API publica `@ritmo/editor`: `DocumentPersistencePort`, `DraftController`, snapshots/suscripcion, `restore`, `recordChange`, proteccion local, `flushRoutine`, `flushAll`, `inspectPending`, carga remota de conflicto, copia exacta, descarte confirmado, bloqueo por expiracion y `createDraftExitAdapter` compatible estructuralmente con M4.
- API publica `@ritmo/editor/react`: schema BlockNote, Activity inline, runtime inyectable para completion/timer, foco por block ID y `RoutineEditor` con metadata, recovery read-only, slash menu y normalizacion de scopes.
- Persistencia: debounce por defecto 750 ms, journal local previo a red, generaciones monotonicas, un unico remote operation en vuelo, CAS por `storageVersion`, rebase de generaciones nuevas y prohibicion de borrar un draft reemplazado.
- Cambios propuestos a M1/M0: agregar una operacion idempotente para crear una rutina con documento inicial y `requestId`. `RoutineRepository.create()` solo crea vacio y `saveDocument()` posterior no hace atomica ni idempotente la copia exacta requerida por `DocumentPersistencePort.createFromDraft()`.
- Supuestos: M0 construye un `DraftController` por usuario autenticado, adapta errores `DOCUMENT_CONFLICT` de M1 a `SaveDocumentResult`, inyecta metadata al `DraftExitAdapter` y descarta el controller bloqueado despues de reautenticar.

## Verificacion

- Tipos, lint, unitarias y build: `pnpm typecheck`, `pnpm lint`, formato dirigido, 111/111 pruebas Vitest y build Vite pasan. La suite global final cubre core, plataforma, datos, timer, features y M2.
- Cobertura M2: envelope/array historico, recovery, Activity invalida editable, round-trip/IDs BlockNote, checklist externa y transicion de scope, foco, timer, proyeccion, IndexedDB/fake CAS, reload offline, retry de red, conflicto, save-as-copy, descarte exacto, fallo local, generaciones y serializacion remota de saves.
- RLS/E2E si aplica: M2 no modifica RLS. No existen specs Playwright activos. La suite RLS real de M1 sigue bloqueada por ausencia de Docker/Podman, segun su handoff.
- Web/Tauri/Capacitor ejecutados: build web compartido paso; `tauri info` valido configuracion, CSP, `frontendDist` y detecto WebView2 `153.0.4234.32`; `cap sync` Android/iOS y `cap doctor android` pasaron con Capacitor `8.5.2`.
- Plataformas no verificadas y motivo: no hubo render/smoke real en WebView2 porque faltan Rust, Cargo, MSVC y Windows SDK. No hubo build/emulador Android porque no hay Java/dispositivo. WKWebView no se declara verificado porque falta macOS/Xcode.
- Evidencia visual/dispositivo: pruebas React/BlockNote ejecutadas en jsdom; no se declara evidencia visual nativa.

## Riesgos

- Casos limite: selectores DOM de checklist son fallback especifico de BlockNote `0.54.2`; cualquier upgrade debe repetir touch, IME, clipboard, undo/redo, drag, scroll/foco y dialog en WebViews.
- Limitaciones y bloqueos: M1 no puede implementar aun la copia idempotente exacta; M0 no debe sustituirla silenciosamente por create-then-save. Los smokes WebView2/Android requeridos siguen pendientes en runners adecuados.
- Trabajo diferido: M0 integra ruta/editor, repositorio, completion/timer y lifecycle; M5 agrega Playwright y matrices Tauri/Android. M1 o una migracion coordinada debe publicar la RPC de copia con `requestId`.

## Confirmaciones

- Sin `any` injustificado, secretos ni service role.
- Sin RLS debilitada, paquetes XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Activity se crea y edita exclusivamente dentro de BlockNote.
- Sin imports Supabase, Tauri o Capacitor en documento/editor; todos los efectos entran por puertos.
- Sin Next, SSR, RSC, Server Actions ni `@supabase/ssr` nuevos.
- Sin modificaciones fuera de ownership no coordinadas; core/plataforma/manifests/lock fueron autorizados y `packages/features` se mantuvo intacto.
