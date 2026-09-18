# Arquitectura

## Capas

| Capa | Responsabilidad | Dependencias permitidas |
|---|---|---|
| `apps/client` | Bootstrap React, router, seleccion de adaptador y providers | Features, data, ports y dynamic imports de `platform-*` solo en bootstrap |
| `apps/desktop` | Configuracion y comandos minimos Tauri | Adaptador Tauri |
| `apps/mobile` | Configuracion, Android e iOS Capacitor | Adaptador Capacitor |
| `packages/core` | Contratos Zod, fechas, errores y utilidades puras | Ninguna plataforma |
| `packages/document-model` | Validacion/proyeccion JSON BlockNote sin React | Core |
| `packages/editor` | BlockNote, Activity, autosave y draft journal | Core, document-model, data ports, platform ports |
| `packages/data-auth` | Supabase JS, repositorios, auth y query keys | Core, platform storage |
| `packages/timer` | Engine, persistencia de snapshot y UI enfoque | Core, platform lifecycle/audio/storage |
| `packages/features` | Shell, sidebar, Hoy y completions | Core, data, editor/timer APIs |
| `packages/ui` | Primitives DOM, tokens y layout sin dominio | Core y React |
| `packages/platform` | Interfaces neutrales de capacidades | Core |
| `packages/platform-*` | Implementaciones web, Tauri y Capacitor | SDK de su plataforma y ports |

Las features no importan Tauri, Capacitor, Rust, Java/Kotlin, Swift ni Supabase directamente. El modelo documental no importa React ni BlockNote.

## Un cliente, tres contenedores

Vite genera una sola vez un `dist/` con base relativa y rutas hash. Los mismos bytes se sirven por HTTPS y se copian a Tauri/Capacitor. El bootstrap detecta el runtime mediante marcadores oficiales y hace dynamic import del adaptador; las features nunca detectan plataforma.

## Providers React

Orden conceptual: PlatformProvider, QueryClient, AuthProvider, ThemeProvider, TimerProvider, CompletionProvider y Router UI. Los providers se dividen por frecuencia de cambio para evitar rerenderizar toda la aplicacion por cada tick del timer.

El editor se importa lazy al entrar a una rutina. Auth, landing, shell y Hoy no deben cargar BlockNote ni Mantine.

## Fuentes de verdad

| Dato | Fuente |
|---|---|
| Titulo de rutina | `routines.name` |
| Documento remoto | `routines.content` + `revision` |
| Borrador no sincronizado | Draft journal local por usuario/rutina |
| Activity | Contenido y props del bloque |
| Completion | `block_completions` |
| Fecha | Zona local del dispositivo |
| Timer activo | Snapshot local del contexto + engine puro |
| Sesion | Supabase Auth con storage inyectado |

## Flujos

### Inicio

La app inicializa plataforma y almacenamiento, restaura auth, crea caches por usuario y decide ruta. El HTML/bundle nunca contiene datos privados precargados. RLS sigue siendo la autorizacion real.

### Guardado

Cada cambio incrementa una generacion y escribe draft local. Solo hay un save en vuelo. Exito elimina el draft solo si sigue siendo la generacion enviada; si hay cambios nuevos actualiza atomicamente su revision base. Conflicto conserva ambas versiones y ofrece recargar remoto o guardar el draft como nueva rutina.

### Lifecycle

En resume se restaura/refresca auth, recalcula fecha, reconcilia timer por timestamps, revisa drafts y revalida queries. Android back primero navega; solo sale desde raiz y sin bloqueo de guardado.

### Logout/cambio de usuario

`SessionExitCoordinator`, propiedad de features, orquesta logout: consulta DraftController, permite sincronizar/guardar copia/descartar/cancelar, limpia timer/completions/QueryClient y al final llama AuthService.logout. AuthService no conoce editor. Expiracion involuntaria usa la misma frontera de limpieza visible, pero conserva journals bloqueados por user ID hasta reautenticar la cuenta.

## Seguridad

URL y anon key son publicas. Tokens persistentes pasan por SecureStoragePort. Tauri capabilities, CSP y permisos Capacitor usan minimo privilegio. No se habilitan comandos remotos, filesystem general, shell, notificaciones o background sin ADR.
