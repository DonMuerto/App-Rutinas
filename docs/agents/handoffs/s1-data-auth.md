# Handoff S1: auth, datos y RLS

> Handoff historico de la arquitectura Next.js. Sus migraciones/RLS son material de migracion; ADR 0002 y el rol M1 son vigentes.

## Identidad

- Sesion: S1.
- Rol: auth, datos y RLS.
- Alcance terminado: migracion Supabase, constraints, grants, RLS, RPCs transaccionales, clientes server/browser, auth email+contrasena, restauracion y proteccion de rutas, repositorios tipados, query keys e invalidaciones.
- Owner receptor: S0, S2, S4, S5 y S6.
- Ola/gate: API de datos de Ola 1 publicada; gate RLS dinamico pendiente exclusivamente de disponer de Docker/Podman local.

## Cambios

- Archivos creados: `supabase/config.toml`, `supabase/migrations/20260913170000_create_private_data.sql`, `supabase/migration.test.ts`, `supabase/tests/rls.test.ts`, `lib/supabase/**`, `lib/repositories/**`, `components/providers/query-provider.tsx`, `app/(auth)/**` y `proxy.ts`.
- Archivos modificados: ninguno fuera del ownership de S1.
- Archivos compartidos tocados con autorizacion: ninguno.
- Dependencias solicitadas o agregadas por S0: ninguna; se usaron `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query` y Zod ya entregados por S0.
- Cambios concurrentes preservados: implementaciones de S2-S5 y `.agents/**`; S1 no las modifico.

## Contratos

- Contratos consumidos: `docs/contracts/domain.md`, `docs/contracts/repositories.md`, `docs/database/schema-rls.md`, `docs/database/time-semantics.md`, `docs/modules/auth-data.md` y ADR 0001.
- API publica de sesion: `createServerSupabaseClient()` para lecturas server, `createServerActionSupabaseClient()` para Server Actions con escritura de cookies estricta, `getCurrentUser()` y `requireUser()` en `@/lib/supabase/session`.
- API publica de repositorios server: `createServerRepositories()` desde `@/lib/repositories/server`.
- API publica de repositorios browser: `createBrowserRepositories()` desde `@/lib/repositories/browser`.
- API publica de rutinas: `listMetadata`, `getById`, `create`, `rename`, `updateIcon`, `updateRecurrence`, `saveDocument`, `reorder`, `delete` y `listForDate`.
- API publica de completions: `list`, `mark` y `unmark`; mark usa `ON CONFLICT DO NOTHING` sobre la clave canonica y conserva `completed_at`.
- API publica de cache: `routineKeys`, `completionKeys` y `repositoryInvalidations` desde `@/lib/repositories`.
- API publica de auth UI: `loginAction`, `registerAction` y `logoutAction` en `app/(auth)/actions.ts`; `/login` y `/registro` incluyen estados pending/error y el proxy protege `/hoy` y `/rutinas/**`.
- SQL publico: `create_routine(text, text, text, date)` asigna posicion final bajo advisory lock; `reorder_routines(uuid[])` valida el conjunto completo, bloquea filas y actualiza posiciones contiguas en una transaccion. Ambas son `security invoker`, revocadas a `anon` y concedidas a `authenticated`.
- Cambios de contrato propuestos: ninguno.
- Supuestos adoptados: los consumidores solo llaman `mark`/`unmark` con IDs obtenidos del documento/proyeccion validada. S1 no interpreta JSON BlockNote porque esa responsabilidad pertenece a S2 y una dependencia Repositorios -> Proyector esta prohibida.

## Verificacion

- Comandos ejecutados: `npm exec --yes pnpm@10.17.1 -- typecheck`, `npm exec --yes pnpm@10.17.1 -- test`, lint dirigido a archivos S1, `npm exec --yes pnpm@10.17.1 -- build`, `npm exec --yes supabase@2.117.0 -- start` y `npm exec --yes supabase@2.45.5 -- db lint --local`.
- Resultado de tipos: exit code 0; `tsc --noEmit` sin diagnosticos en la ultima ejecucion.
- Resultado de lint del modulo: exit code 0; ESLint sin errores ni warnings en archivos S1.
- Resultado de lint global: bloqueado por 17 errores de S2 en `app/(app)/rutinas/[routineId]/page.tsx` y `components/editor/**`, mas 3 warnings en `.agents/**`; no hay diagnosticos S1.
- Resultado de pruebas del modulo: 22 pruebas S1 aprobadas en 3 archivos; la suite global mas reciente antes del ultimo endurecimiento aprobo 90 y omitio 1 RLS por entorno.
- Resultado de build: exit code 0; Next.js 16.3.5 compilo `/login`, `/registro`, `/hoy`, `/rutinas/[routineId]` y Proxy.
- Evidencia estatica RLS: 3 pruebas verifican RLS habilitada, cuatro policies por tabla, ausencia de `security definer`, revocacion anon y columnas de auditoria no escribibles.
- Evidencia dinamica RLS preparada: `supabase/tests/rls.test.ts` usa `signUp`, `getUser`, `signOut` y `signInWithPassword` reales; prueba SELECT/INSERT/UPDATE/DELETE con A, B y anon en ambas tablas, `WITH CHECK`, constraints, auditoria, idempotencia, cascada, RPC anon, reorder invalido sin cambios y creates concurrentes contiguos.
- Resultado RLS dinamico: no ejecutado; `supabase start` falla con `docker: command not found (podman also not found)` y `db lint --local` falla al conectar a `127.0.0.1:54322`.
- Comando RLS reproducible tras iniciar Docker/Podman: obtener URL y anon key locales con `supabase status`, y ejecutar `RUN_SUPABASE_RLS_TESTS=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-local> npm exec --yes pnpm@10.17.1 -- vitest run supabase/tests/rls.test.ts`. La prueba rechaza destinos no loopback.
- Variables requeridas en runtime: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; ambas ya estaban en `.env.example` y no se modifico ese archivo de S0.
- Busqueda de seguridad: sin ocurrencias de service role en codigo/config S1 y sin paquetes XL en `package.json`.

## Riesgos

- Casos limite cubiertos: nombres vacios/trim, recurrencias excluyentes, documento raiz no-array, fecha local explicita, Activity con ambito propio, retries de completion, recurso ajeno indistinguible, IDs duplicados/faltantes/ajenos en reorder, concurrencia create/reorder, spoof de auditoria, sesion expirada y open redirect.
- Limitaciones conocidas: sin Docker/Podman no se pudo aplicar la migracion ni ejecutar sesiones Data API locales; esta evidencia es obligatoria antes del gate de seguridad.
- Trabajo diferido: S6 debe ejecutar la prueba RLS preparada en infraestructura local y agregarla a CI; S0 debe agregar un script raiz `test:rls` si desea un comando package estable, porque S1 no puede modificar `package.json`.
- Bloqueos para consumidores: ninguno para compilar o integrar repositorios. El release queda bloqueado hasta aprobar RLS dinamico.
- Solicitud a S2/S4: conservar la regla de que completions solo reciben IDs procedentes del proyector/documento validado; la base no puede verificar IDs internos de JSONB.
- Solicitud a S5: presentar el query `authError=logout` o conectar un estado equivalente cuando falle logout; el action no anuncia exito ni elimina cookies silenciosamente.

## Confirmaciones obligatorias

- No se uso `any` injustificado.
- No se introdujo `SUPABASE_SERVICE_ROLE_KEY`.
- No se debilito RLS.
- No se agregaron paquetes `@blocknote/xl-*`.
- No se implemento PWA, Service Worker, Web Notifications o Wake Lock.
- No se creo una pantalla de edicion de Activity.
- No se modifico `package.json`, lockfile, configuraciones raiz ni archivos fuera del ownership S1.
