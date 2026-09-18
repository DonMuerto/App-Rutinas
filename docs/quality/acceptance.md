# Criterios de aceptacion

## Seguridad y auth

- A-01: registro, login, restauracion y logout funcionan en los tres targets.
- A-02: la SPA valida sesion antes de mostrar rutas privadas.
- A-03: RLS impide acceso cruzado A/B y acceso anonimo.
- A-04: no existe service role en bundle, binarios, CI o runtime.
- A-05: Tauri usa keyring del SO y Capacitor Keychain/Keystore mediante el plugin MIT aprobado.
- A-06: logout resuelve/elimina drafts y limpia caches/stores; expiracion conserva draft bloqueado solo para la misma cuenta.

## Editor y datos

- B-01: Activity se inserta y edita dentro de BlockNote.
- B-02: `routines.name` es el titulo unico.
- B-03: round-trip conserva estructura, props e IDs.
- B-04: cada cambio crea draft local antes de depender de red.
- B-05: save usa revision esperada; conflicto no sobrescribe remoto.
- B-06: datos desconocidos no montables entran en recovery read-only.
- B-07: subtareas diarias no contaminan `checked` persistente.
- B-08: BlockNote supera smoke WebView2 y Android WebView.

## Hoy y completions

- C-01: fecha usa zona local del dispositivo y se recalcula en resume.
- C-02: Hoy incluye rutinas correctas, ordena estable y no edita documentos.
- C-03: editor y Hoy comparten completion state por usuario/fecha.
- C-04: completar es manual e independiente del timer.

## Timer

- D-01: countdown e intervalos respetan deadlines y no tienen descanso final.
- D-02: existe un timer por contexto y Start no reemplaza otro.
- D-03: background no ejecuta runners; resume reconcilia timestamps.
- D-04: reinicio restaura snapshot valido del mismo usuario.
- D-05: Cancel/Dismiss/logout eliminan snapshot según contrato.
- D-06: sonido/color no son la unica señal y done no completa Activity.
- D-07: no hay pausa, skip, reset, notificaciones o Wake Lock.

## UI

- E-01: sidebar plano, reorder accesible y rollback.
- E-02: 360/768/1440 px sin scroll horizontal.
- E-03: safe areas, teclado movil y Android back no pierden edicion.
- E-04: tema shell/BlockNote sincronizado, contraste AA, foco y reduced motion.
- E-05: editor domina visualmente; no hay dashboard de tarjetas.

## Arquitectura

- F-01: una SPA React/Vite alimenta web, Tauri y Capacitor.
- F-02: features/dominio no importan Tauri o Capacitor.
- F-03: HashRouter funciona por HTTP y assets locales.
- F-03a: web, Tauri y Capacitor consumen el mismo `dist/` byte a byte.
- F-04: BlockNote se carga lazy y queda fuera del chunk inicial.
- F-05: Tauri usa ventana unica, CSP y capabilities minimas.
- F-06: Capacitor release usa bundle local, no `server.url`.
- F-07: target final no contiene Next.js, `@supabase/ssr`, RSC o Server Actions.
- F-08: no existe React Native/Expo ni forks de UI.

## Release

- G-01: tipos, lint, unitarias, RLS, E2E y build Vite pasan.
- G-02: Tauri Windows y Capacitor Android tienen smoke real.
- G-03: no hay paquetes XL, servicios de trial ni features prohibidas.
- G-04: rollback de web, desktop, Android y esquema esta documentado.
- G-05: iOS/macOS solo se aprueban con evidencia en macOS/Xcode.

Seguridad, licencia, coste o perdida silenciosa bloquean release. Un target sin entorno compatible se marca no verificado.
