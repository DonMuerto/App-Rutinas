# Modulo de autenticacion y datos

## Objetivo

Proveer sesion autenticada y repositorios Supabase bajo RLS para web, Tauri y Capacitor. Es la unica frontera que conoce tablas, PostgREST y Supabase JS.

## Responsabilidades

- Registro sin confirmacion de email, login, logout, restauracion y expiracion de sesion.
- Inicializacion de sesion antes de mostrar rutas privadas y guard React coherente.
- Un cliente Supabase por contexto configurado con SecureStoragePort.
- Migraciones, constraints, indices, triggers, grants y RLS descritos en [schema-rls.md](../database/schema-rls.md).
- Repositorios definidos en [repositories.md](../contracts/repositories.md).
- Tipos generados de base como detalle interno.
- Errores de dominio que no filtren detalles de recursos ajenos.
- Query keys segmentadas por usuario, refresh en resume y limpieza total al cambiar usuario.

## No objetivos

- No renderizar editor, sidebar, Today ni timer.
- No usar service role.
- No crear servidor propio, middleware Next ni Server Actions.
- No implementar OAuth, organizaciones, archivos o Realtime.
- No decidir la fecha actual en servidor.

## Flujo de sesion

La SPA muestra un estado de arranque mientras restaura storage y valida el usuario con Supabase. El guard controla experiencia, pero RLS es la autorizacion real. El bundle nunca contiene datos privados precargados.

AuthService expone logout de bajo nivel y eventos de sesion; no inspecciona drafts, timer o UI. `SessionExitCoordinator` de M4 es el unico punto usado por acciones de logout. La restauracion lee una clave pre-auth unica y obtiene el user ID desde la sesion validada.

Estados requeridos: inicializando, anonimo, autenticado, refrescando, sesion expirada, credenciales invalidas y red. Confirmacion y recuperacion de contrasena siguen fuera del MVP. Desktop/mobile persisten refresh material mediante almacenamiento seguro auditado, nunca Preferences/Tauri Store sin cifrado.

## Operaciones de datos

- Sidebar lista metadatos sin descargar documentos.
- Editor obtiene una rutina completa por ID.
- Hoy recibe documentos solo de rutinas elegibles para una fecha explicita.
- Nombre/recurrencia son mutaciones parciales; content usa revision esperada.
- Las completions usan upsert/delete idempotentes.
- Reordenar normaliza posiciones del usuario como una operacion coherente.

## Seguridad

Las pruebas RLS deben demostrar aislamiento con usuarios A y B y rol anonimo para cada operacion. Un fallo de acceso a una rutina ajena se presenta como inaccesible, sin confirmar su existencia. Una tabla que no aparece en Data API se corrige con grants, nunca quitando RLS.

## Handoff

Entregar migracion incremental, cliente SPA, AuthService, repositorios, query keys y evidencia RLS. Variables objetivo: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Confirmar ausencia de service role, Next y `@supabase/ssr`.
