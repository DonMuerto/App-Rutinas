# React multiplataforma

## Estructura objetivo

```text
apps/
  client/        React 19, Vite, HashRouter y composicion
  desktop/       Tauri 2 y src-tauri
  mobile/        Capacitor, android e ios
packages/
  core/
  platform/
  platform-web/
  platform-tauri/
  platform-capacitor/
  data-auth/
  document-model/
  editor/
  timer/
  features/
  ui/
supabase/
tests/
```

El workspace usa pnpm. Cada paquete declara exports explicitos y no importa mediante rutas internas de otro paquete.

## React

- Una raiz React por contexto de ejecucion.
- Router hash comun para web y bundles locales.
- TanStack Query para estado remoto; no duplicar filas Supabase en stores React.
- Estado efimero local cerca del componente; stores globales solo para auth, lifecycle, timer y completion compartida.
- `startTransition` para navegacion/actualizaciones no urgentes y `useDeferredValue` cuando la proyeccion de documentos grandes afecte escritura.
- No agregar `useMemo`/`useCallback` por defecto; medir o seguir necesidad de API estable.
- Lazy import de editor y paneles pesados.
- Event listeners globales se registran una vez y se limpian.

## Routing

Rutas canónicas:

| Ruta hash | Vista |
|---|---|
| `#/login` | Login |
| `#/registro` | Registro |
| `#/hoy` | Vista Hoy |
| `#/rutinas/:routineId` | Editor |

El bloque origen viaja como query `activity`. Enlaces externos usan ExternalLinksPort. Android back usa NavigationPort. No se inspecciona user-agent para elegir router.

## Builds

El cliente genera una vez `dist/` con assets relativos. Tauri usa `frontendDist`, Capacitor `webDir` y web publica exactamente esos bytes. No hay build mode por plataforma. El bootstrap detecta runtime y carga dinamicamente un adaptador; un cambio de entorno reconstruye juntos los tres artefactos.

Variables permitidas: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Todo `VITE_*` se considera publico.

## Adaptacion UI

CSS usa safe-area insets, viewport dinamico y breakpoints por espacio, no por plataforma. Tauri usa ventana unica con tamano minimo. Capacitor gestiona teclado y status bar desde el shell, sin que editor conozca plugins.

## Limites

- No React Native/Expo.
- No SSR/RSC.
- No PWA/service worker.
- No logica de producto Rust/Kotlin/Swift.
- No importaciones directas de SDK nativo en features.
- No offline-first ni sincronizacion bidireccional general.
