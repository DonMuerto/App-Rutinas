# Despliegue y operacion

## Canales

- Web: `dist` Vite en hosting estatico HTTPS.
- Desktop: Tauri 2, con Windows como gate MVP.
- Mobile: Capacitor, con Android sideload como gate MVP.
- Supabase Free: Auth, Postgres y Data API.

Variables publicas: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Todo `VITE_*` queda en el bundle. Nunca incluir service role, passwords de vault, keystores o credenciales de firma.

## Web

HashRouter no necesita rewrites. Vercel Hobby puede alojar estaticos solo dentro de sus terminos personales/no comerciales. Un hosting equivalente requiere verificar limites, pero no cambia el bundle.

## Tauri

CI construye por OS. Windows es obligatorio; Linux/macOS cuando haya runner. CSP y capabilities se revisan como seguridad. Artefactos sin firma pueden mostrar advertencias. Firma, notarizacion y updater quedan fuera hasta aprobar presupuesto y credenciales.

## Capacitor

Build Vite precede `cap sync`. Release incluye assets locales y no usa `server.url`. Android produce APK de prueba sin versionar keystore. iOS requiere macOS, Xcode y provisioning.

Google Play y Apple Developer requieren cuentas/pagos; publicacion en tiendas queda fuera. Android sideload y desarrollo iOS local son los canales MVP.

## Release

1. Congelar contratos y version.
2. Ejecutar tipos, lint, unitarias, RLS y E2E web.
3. Construir Vite, Tauri Windows y Capacitor Android.
4. Aplicar primero migraciones compatibles.
5. Desplegar web y ejecutar smoke.
6. Probar artefactos nativos en entorno limpio.
7. Publicar solo canales autorizados y conservar checksums.

## Smoke

Auth, rutina, autosave revisionado, draft restore, Hoy, completion, timer restore, tema y logout. En native verificar bundle local, resume/back/close, secure storage y ausencia de permisos prohibidos.

## Rollback

Web conserva dist anterior. Desktop/Android conservan artefacto previo; drafts versionados deben migrar o seguir legibles. Base de datos se corrige hacia adelante. Incidente RLS bloquea todos los canales.
