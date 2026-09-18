# ADR 0002: React, Vite, Tauri y Capacitor

Estado: aceptada. Enmienda cualquier regla previa incompatible con Capacitor, Next.js, SSR o persistencia local del timer.

## Contexto

Ritmo debe ejecutarse en navegador, PC y movil. BlockNote es React y depende del DOM, por lo que React Native no permite compartir el editor. Next.js SSR tampoco produce un bundle estatico simple para dos shells nativos con rutas dinamicas.

## Decision

- Migrar a una SPA React 19 construida con Vite.
- Usar un workspace pnpm con paquetes compartidos.
- Empaquetar el mismo cliente con Tauri 2 para escritorio y Capacitor para movil.
- Generar un unico `dist/` byte a byte y usar routing hash comun.
- Mantener Tauri y Capacitor como adaptadores; ninguna feature importa sus SDKs.
- Usar Supabase JS directo y RLS como frontera de seguridad.
- Persistir drafts y snapshot del timer localmente para reconciliar suspension o terminacion.
- Mantener online-first; no implementar sincronizacion offline general.

## Targets MVP

| Target | Gate obligatorio |
|---|---|
| Web moderno | Build estatico y E2E Chromium desktop/movil |
| Windows | Tauri dev/build y smoke de instalable |
| Android | Capacitor sync/build y smoke en emulador/dispositivo |
| Linux/macOS | Configuracion valida; build cuando exista runner compatible |
| iOS | Configuracion valida; build/smoke solo en macOS con Xcode |

Publicar en tiendas, firmar comercialmente o notarizar no es parte del MVP porque puede requerir pagos y credenciales. APK local y builds de desarrollo son suficientes para el gate inicial.

## Seguridad

- Variables `VITE_*` son publicas. Solo URL y anon/publishable key de Supabase pueden incluirse.
- Refresh tokens usan SecureStoragePort. Web usa almacenamiento web versionado. Tauri usa un adaptador Rust minimo al keyring del sistema. Capacitor usa `@aparajita/capacitor-secure-storage` (MIT), Keychain/Android Keystore e iCloud sync desactivado.
- `Preferences`, Tauri Store y localStorage no se describen como almacenamiento seguro nativo.
- Logout explicito se bloquea con drafts pendientes; al sincronizar o descartar elimina journals, Query cache, completions y timer. Expiracion involuntaria conserva el draft bloqueado y solo lo revela tras reautenticar el mismo user ID.
- Capabilities y permisos nativos siguen minimo privilegio.

## Lifecycle

Un puerto comun emite active, background, resume, close-requested y back-requested. Auth refresca al reanudar; fecha se recalcula; timer reconcilia por timestamps; autosave escribe draft antes de intentar red remota.

No se mantiene JavaScript ejecutando en background. No se usan background runners ni notificaciones.

## Consecuencias

- Se retiran Next.js, `@supabase/ssr`, Server Actions y next-themes de la arquitectura objetivo.
- Auth guard cliente es experiencia, no seguridad; RLS protege datos.
- El bundle puede crecer por BlockNote, por lo que editor se carga de forma lazy solo en la ruta de rutina.
- BlockNote requiere pruebas reales en WebView2, Android WebView y WKWebView.
- La implementacion Next actual se considera material de migracion, no contrato arquitectonico.
