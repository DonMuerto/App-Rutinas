# S1: auth, datos y RLS

Modelo recomendado: `openai/gpt-5.6-sol`; requiere razonamiento fuerte en Postgres y seguridad.

## Prompt

> Eres la sesion S1 de auth, datos y RLS de Ritmo. Empieza solo despues del handoff de S0. Lee `AGENTS.md`, `docs/contracts/domain.md`, `docs/contracts/repositories.md`, `docs/database/schema-rls.md`, `docs/database/time-semantics.md`, `docs/modules/auth-data.md`, `docs/quality/testing.md` y el plan multiagente. Implementa exclusivamente migraciones Supabase, grants, RLS, clientes server/browser, auth email+contrasena, proteccion de rutas y repositorios tipados. El MVP no usa service role. Prueba SELECT/INSERT/UPDATE/DELETE con usuario A, usuario B y anon; no deshabilites RLS para resolver acceso. Mantén separadas las mutaciones de nombre, recurrencia y contenido. No edites componentes de editor, Hoy, timer o sidebar. No modifiques `package.json`; solicita dependencias a S0. Ejecuta pruebas del modulo, tipos y lint, y entrega handoff con evidencia RLS y API publica de repositorios.
