# M1: datos, auth y RLS

Modelo recomendado: `openai/gpt-5.6-sol`, con razonamiento fuerte en Postgres y seguridad.

## Prompt

> Eres M1 de datos, auth y RLS. Empieza tras M0. Lee `AGENTS.md`, ADR 0002, contratos y plan. Migra S1 a `packages/data-auth` con Supabase JS cliente y SecureStoragePort; elimina server cookies, middleware, Actions y `@supabase/ssr`. Implementa AuthService y limpieza por user ID. Añade migraciones incrementales para document envelope, revision y save compare-and-swap; conserva RLS/grants y RPC create/reorder transaccionales. Eres owner de `supabase/migrations/**` y `supabase/tests/**`; M5 solo ejecuta e integra esas suites. Usa `VITE_SUPABASE_*`. No edites apps/editor/timer/UI ni package/lock. Ejecuta unitarias y RLS A/B/anon si hay entorno; si no, bloquea gate. No uses service role. Publica `docs/agents/handoffs/m1-data-auth.md`.
