# Modulo de autenticacion y datos

## Objetivo

Proveer sesion autenticada, clientes Supabase y repositorios tipados bajo RLS. Esta es la unica frontera que conoce tablas, PostgREST y cookies de Supabase.

## Responsabilidades

- Registro sin confirmacion de email, login, logout, restauracion y expiracion de sesion.
- Proteccion del area privada y redirecciones coherentes.
- Cliente servidor basado en cookies y cliente navegador con anon key.
- Migraciones, constraints, indices, triggers, grants y RLS descritos en [schema-rls.md](../database/schema-rls.md).
- Repositorios definidos en [repositories.md](../contracts/repositories.md).
- Tipos generados de base como detalle interno.
- Errores de dominio que no filtren detalles de recursos ajenos.
- Claves e invalidaciones de TanStack Query acordadas con consumidores.

## No objetivos

- No renderizar editor, sidebar, Today ni timer.
- No usar service role.
- No crear API routes como capa redundante cuando sesion+RLS resuelvan el caso.
- No implementar OAuth, organizaciones, archivos o Realtime.
- No decidir la fecha actual en servidor.

## Flujo de sesion

El servidor valida la sesion inicial antes de entregar contenido privado. La renovacion de cookies en middleware no sustituye esa validacion. Los componentes cliente reciben solo los datos serializables minimos y crean su cliente de navegador dentro de la frontera cliente.

Estados requeridos: cargando, credenciales invalidas, sesion expirada, error de red y logout completado. Para evitar depender de SMTP, la confirmacion de email esta deshabilitada y un registro valido crea sesion en el MVP. Recuperacion de contrasena queda fuera de alcance; no se muestra un flujo incompleto.

## Operaciones de datos

- Sidebar lista metadatos sin descargar documentos.
- Editor obtiene una rutina completa por ID.
- Hoy recibe documentos solo de rutinas elegibles para una fecha explicita.
- Las mutaciones de nombre, recurrencia y contenido son parciales y separadas.
- Las completions usan upsert/delete idempotentes.
- Reordenar normaliza posiciones del usuario como una operacion coherente.

## Seguridad

Las pruebas RLS deben demostrar aislamiento con usuarios A y B y rol anonimo para cada operacion. Un fallo de acceso a una rutina ajena se presenta como inaccesible, sin confirmar su existencia. Una tabla que no aparece en Data API se corrige con grants, nunca quitando RLS.

## Handoff

Entregar migraciones, clientes, auth, interfaces de repositorio, politica de errores, claves de cache y evidencia RLS. Enumerar variables requeridas. Confirmar por busqueda que service role no existe.
