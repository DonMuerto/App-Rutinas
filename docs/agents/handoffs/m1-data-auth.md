# Handoff M1: datos, auth y RLS

## Identidad

- Sesion/rol: M1, datos, autenticacion y RLS.
- Ola/gate: Ola 1, gate de datos y seguridad; copia atomica/idempotente de drafts implementada, gate RLS dinamico bloqueado por entorno.
- Owner receptor: M0 para integracion de providers y rutas; M5 para ejecutar e integrar la suite RLS/E2E.
- Base commit y estado de worktree: `dd1677d5fb6079b4a8c528992dbb9f66ed7a1ef6` (`chore: checkpoint Next implementation before Vite migration`). El trabajo M0-M4 posterior permanece concurrente y sin commit.

## Cambios

- Archivos creados/modificados en esta extension: `packages/data-auth/src/database.types.ts`, `index.ts`, `repositories.ts`, `repositories.test.ts`, `types.ts`, `supabase/migrations/20260918130000_create_routine_from_draft.sql`, `supabase/migration.test.ts`, `supabase/tests/rls.test.ts`, `docs/contracts/repositories.md`, `docs/database/schema-rls.md` y este handoff.
- Ownership y transferencias: M1 entrega cliente Supabase SPA, auth, repositorios, query keys, migracion incremental y suites de datos. M0 debe consumir `createDataAuthServices`; M5 debe ejecutar la suite RLS con Supabase local.
- Dependencias solicitadas a M0: resueltas previamente en `packages/data-auth/package.json` y lockfile. M1 no modifico manifests ni lockfile.
- Cambios concurrentes preservados: se adopto el envelope `RoutineDocument` publicado por M2 en `@ritmo/core`; no se modificaron core, editor, timer, features, apps ni adaptadores de plataforma.

## Contratos

- Documentos consumidos: `contracts/repositories.md`, `contracts/document-schema.md`, `contracts/platform.md`, `database/schema-rls.md`, `modules/auth-data.md`, ADR 0002 y plan multiagente.
- API publica entregada: `createDataAuthServices({ secureStorage, queryClient, environment? })`, `AuthService`, repositorios de rutinas/completions, query keys segmentadas, invalidaciones, `clearUserQueryData` y tipos de dominio del paquete.
- Auth entregada: restauracion validada con `getUser`, registro/login/logout/refresh, estados requeridos, eventos, usuario obligatorio y persistencia bajo `ritmo.supabase.session.v1` mediante `SecureStoragePort`. Logout/cambio de usuario limpia QueryClient y procedencia documental privada del usuario anterior.
- Datos entregados: sidebar sin content, rutina completa con revision, create/reorder por RPC, mutaciones parciales, Hoy por fecha explicita, completions idempotentes y validacion de que Activity/checklist y su ambito provienen del documento cargado por el usuario actual.
- Copia de draft entregada: `RoutineRepository.createFromDraft({ sourceRoutineId, document, metadata, requestId })` valida UUID/envelope/metadatos e invoca `create_routine_from_draft`. La RPC `security invoker` verifica el origen bajo RLS, conserva el JSON exacto en el insert, usa revision inicial `0`, asigna la posicion final bajo el lock compartido por usuario y devuelve el mismo ID para cada `user_id + request_id`, incluso si el origen se elimina despues del primer exito.
- Idempotencia privada: `routine_draft_copy_requests` tiene PK compuesta, RLS y grants solo de select/insert; las policies exigen un contexto transaccional ligado al request que solo establece la RPC. No hay update/delete de Data API ni FK con cascada al resultado que permita reutilizar una clave.
- Persistencia entregada: envelope exacto `{ schemaVersion: 1, blocks }`, migracion de arrays historicos, revision inicial 0 y `save_routine_document` compare-and-swap `security invoker`. Todo guardado aceptado incrementa revision, incluso si el JSON no cambia; un update directo de content/revision es rechazado por trigger.
- Cambios de contrato: `docs/contracts/repositories.md` y `docs/database/schema-rls.md` documentan la operacion autorizada. `repositoryInvalidations.routineCreated` ya cubre sidebar y Hoy para creacion normal o desde draft, por lo que no se duplico API de cache.
- Cambio requerido a M2 para integrar: `DraftController` genera actualmente `${userId}:${routineId}:${storageVersion}`, que no es UUID. Debe persistir/generar un UUID estable por intento logico antes de adaptar `DocumentPersistencePort.createFromDraft` al repositorio; queda fuera del ownership autorizado de esta sesion.
- Supuestos: M0 conserva un `QueryClient` por contexto y llama `dispose()` al desmontar el contexto de datos. Cero filas del RPC solo se presenta como conflicto si la rutina fue cargada por el mismo usuario vigente; en otro caso se presenta como inaccesible.

## Verificacion

- Tipos, lint, unitarias y build: TypeScript estricto paso; ESLint dirigido a `packages/data-auth/src` paso; formato dirigido paso; 13/13 unitarias enfocadas de repositorios/query keys y suite global 126/126 pasaron. No se ejecuto build en esta extension de datos.
- RLS/E2E si aplica: 7/7 invariantes estaticas de migracion pasaron. La suite dinamica ahora cubre concurrencia/replay, aislamiento de la misma UUID entre usuarios, JSON exacto, revision `0`, posicion final, origen ajeno/ausente indistinguible, ledger no accesible directamente, anon y replay tras eliminar origen. Quedo preparada pero se omitio al no definir `RUN_SUPABASE_RLS_TESTS=1`: no existen Docker/Podman ni binario Supabase local en el entorno.
- Web/Tauri/Capacitor ejecutados: no se ejecutaron build ni smoke porque no corresponden a esta extension M1 sin UI.
- Plataformas no verificadas y motivo: Postgres/Data API local no verificado por ausencia de runtime de contenedores. Por la misma razon no se ejecutaron `supabase start`, `db reset` ni `db lint`.
- Evidencia visual/dispositivo: no aplica a un modulo sin UI.
- Herramientas: `pnpm` no estaba disponible en PATH; las herramientas instaladas se ejecutaron con `node.exe` directamente, sin modificar manifests ni lockfile.

## Riesgos

- Casos limite: CAS concurrente, advisory lock, policies con contexto transaccional y RPC de copia dependen de semantica real de Postgres/PostgREST; la suite preparada debe ejecutarse antes de aprobar el gate. Una copia eliminada no se recrea con el mismo request: el replay conserva el ID historico y el repositorio lo presenta como inaccesible.
- Limitaciones y bloqueos: gate RLS dinamico bloqueado exclusivamente por falta de Docker/Podman. No presentar M1 como gate de seguridad aprobado hasta obtener una ejecucion A/B/anon verde.
- Trabajo diferido: M2 cambia su request ID compuesto por UUID estable; M0 adapta `DocumentPersistencePort.createFromDraft` y aplica `routineCreated`; M5 levanta Supabase local y ejecuta `RUN_SUPABASE_RLS_TESTS=1` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` loopback.

## Confirmaciones

- Sin `any` injustificado, secretos ni service role.
- Sin RLS debilitada, XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Sin Activity separada del editor.
- Sin imports Tauri/Capacitor; plataforma entra solo mediante `SecureStoragePort`.
- Sin Next, cookies servidor, middleware, Server Actions, SSR ni `@supabase/ssr`.
- Sin modificaciones fuera de ownership no coordinadas; se preservaron todos los cambios concurrentes.
