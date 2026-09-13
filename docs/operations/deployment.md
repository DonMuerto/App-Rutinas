# Despliegue y operacion

## Arquitectura prevista

- Next.js en Vercel Hobby mientras el uso sea personal/no comercial.
- Supabase Free para Auth, Postgres y Data API.
- Supabase local para desarrollo y pruebas RLS.
- GitHub Free para versionado y despliegue.

Los limites y terminos cambian; verificarlos en las paginas oficiales antes de crear recursos o lanzar. Ningun proveedor puede exigir tarjeta ni depender de un trial temporal.

## Entornos

Preferencia: desarrollo local, un proyecto remoto de staging y uno de produccion, respetando el limite vigente de proyectos gratuitos. Si no hay staging remoto, previews no se conectan a produccion.

Variables MVP permitidas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No configurar `SUPABASE_SERVICE_ROLE_KEY`, ni siquiera vacia en `.env.example`, para no sugerir que es parte de la arquitectura.

## Release

1. Congelar contratos del release.
2. Ejecutar tipos, lint, unitarias, RLS, E2E y build.
3. Revisar migraciones y compatibilidad.
4. Aplicar primero cambios de base compatibles con frontend anterior.
5. Desplegar frontend.
6. Ejecutar smoke test autenticado y anonimo.
7. Revisar logs y consumo.

Las migraciones destructivas requieren plan de expansion/migracion/retirada. Preferir correccion hacia adelante a rollback destructivo.

## Smoke test

- Login responde y rutas privadas rechazan anon.
- Crear, guardar y recargar rutina funciona.
- Hoy selecciona fecha correcta.
- Completion marca y desmarca.
- Usuario B no accede a rutina de A.
- Timer y tema funcionan.
- Desktop/movil no presentan errores de hidratacion o scroll horizontal.
- No se registra Service Worker ni se pide permiso de notificacion.

## Rollback

Frontend puede volver a un deploy anterior solo si el esquema sigue siendo compatible. Datos se recuperan mediante migracion correctiva o backup disponible, nunca borrando automaticamente. Un incidente RLS bloquea release, conserva evidencia, corrige politicas/grants y repite toda la matriz A/B/anon.

## Uso comercial

Vercel Hobby no se asume valido para cobrar usuarios. Antes de monetizar, crear una decision de hosting y revisar costes/licencias. Esto no cambia el requisito de evitar servicios con tarjeta o trial durante el MVP actual.
