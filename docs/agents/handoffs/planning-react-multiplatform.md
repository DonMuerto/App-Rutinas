# Handoff: replanificacion React multiplataforma

## Identidad

- Sesion/rol: coordinacion documental.
- Ola/gate: documentacion previa a M0.
- Owner receptor: M0-M5.
- Base: worktree con implementacion Next historica no consolidada; no se modifico codigo de aplicacion.

## Cambios

- Arquitectura objetivo: React 19 + Vite, Tauri 2 y Capacitor.
- ADR 0002 agregado y ADR 0001 enmendado.
- Contratos actualizados para plataforma, lifecycle, secure storage, timer restore, draft journal y revision de documentos.
- Pruebas, aceptacion, despliegue y plan reescritos.
- Seis prompts M0-M5 publicados.
- Handoffs existentes S0, S1, S3, S4 y S5 marcados historicos sin alterar su evidencia tecnica; S2 no publico handoff.

## Decisiones

- BlockNote sigue siendo unico editor; React Native/Expo queda fuera.
- HashRouter y un bundle local comun.
- RLS es seguridad real; auth guard cliente es UX.
- Timer y drafts se persisten localmente y se reconcilian; no hay background runner.
- Gates primarios: web, Tauri Windows y Capacitor Android.
- Stores/apps, firma comercial y notarizacion quedan fuera del MVP.

## Riesgos y bloqueos

- El codigo actual tiene cambios no versionados; M0 esta autorizado a crear primero un checkpoint local sin push.
- Falta handoff historico S2; M0 lo sustituye por inventario tecnico del codigo presente.
- RLS dinamico sigue pendiente si no existe Docker/Podman.
- BlockNote requiere evidencia real en WebView2/Android WebView; WKWebView necesita macOS.
- Los adaptadores elegidos requieren verificar integracion, reinstalacion y borrado en dispositivo; la seleccion ya esta cerrada.

## Confirmaciones

- Solo se modifico documentacion Markdown.
- No se agregaron dependencias ni codigo de producto.
- No se debilito RLS ni se autorizo service role.
- No se autorizan PWA, notificaciones, background runner o Wake Lock.
