# Modulo de shells de plataforma

## Tauri

- Tauri 2, ventana unica y barra de sistema.
- `frontendDist` usa dist Vite; desarrollo usa servidor Vite.
- CSP solo permite assets locales y endpoints Supabase necesarios.
- Capabilities minimas; sin shell, filesystem general, updater o comandos remotos.
- Close request emite LifecyclePort y respeta draft guard.
- Gate primario Windows; Linux/macOS cuando exista runner.

## Capacitor

- `webDir` usa dist; release incluye bundle local y nunca `server.url`.
- Plugins iniciales: App lifecycle/back y `@aparajita/capacitor-secure-storage` con iCloud sync desactivado; keyboard/status bar solo si se justifican.
- Sin notificaciones, background runner, camara, ubicacion o filesystem.
- Android back navega antes de salir. Safe areas y teclado se prueban en dispositivo.
- Gate primario Android; iOS requiere macOS/Xcode.

## Distribucion

Builds de desarrollo y sideload forman parte del MVP. App Store, Google Play, notarizacion macOS y firma comercial Windows quedan fuera por costes/cuentas.

## Aceptacion

- Ambos shells cargan el mismo router y bundle local.
- Login/Supabase funcionan con CSP y origins.
- Resume reconcilia auth, fecha, timer y drafts.
- Logout elimina storage seguro y estado de usuario.
- No hay dominio duplicado en Rust/Kotlin/Swift.
- Tauri limita codigo Rust a keyring del SO y adaptacion lifecycle/cierre; no guarda tokens en Store.
