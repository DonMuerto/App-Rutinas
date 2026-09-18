# Estrategia de pruebas

## Principio

Cada owner prueba su logica. M1 mantiene `supabase/tests`; M5 los ejecuta en CI y mantiene fixtures transversales, integracion, E2E y smoke nativo. No se aprueba una plataforma usando solo jsdom.

## Capas

| Capa | Cobertura |
|---|---|
| Tipos/lint | TypeScript strict, boundaries e imports prohibidos |
| Unitarias | Fecha, timer, validadores, proyeccion, repositories y drafts |
| Componentes | Activity, editor, Hoy, sidebar, auth y overlay |
| RLS | Grants, policies y aislamiento A/B/anon |
| E2E web | Flujo completo a 360, 768 y 1440 px |
| Native smoke | Tauri Windows y Capacitor Android |
| Builds | Vite, Tauri y Capacitor; targets Apple solo en macOS |

## Contratos criticos

Timer usa reloj falso y cubre restauracion tras varias fases. Document-model usa fixtures validos, invalidos y desconocidos sin importar BlockNote. Fecha se prueba en UTC-/UTC+, medianoche, resume y cambio de zona.

Draft journal cubre escritura atomica, recuperacion tras cierre, aislamiento por usuario, limpieza tras save, red fallida, revision remota distinta y logout. Ningun test acepta sobrescritura silenciosa.

## RLS

Supabase local usa usuario A, B y anon para SELECT/INSERT/UPDATE/DELETE, completions, reorder y save revisionado. Service role no participa en las afirmaciones de aislamiento. El gate requiere ejecucion real, no solo inspeccion SQL.

## E2E web

1. Registro/login y restauracion.
2. Crear rutina, editar bloques y Activity.
3. Configurar intervalos y subtareas.
4. Guardar, recargar y verificar IDs/revision.
5. Hoy, completion y navegacion al origen.
6. Timer, suspension simulada y restore.
7. Draft pendiente, red fallida y conflicto.
8. Reorder, tema, responsive y logout sin fuga de estado.

## Matriz de plataforma

| Target | Evidencia minima |
|---|---|
| Web | Build estatico y Playwright Chromium desktop/mobile |
| Tauri Windows | Build/check, arranque, auth, editor, close lifecycle y timer restore |
| Capacitor Android | Sync/build, emulador/dispositivo, teclado, back, resume, secure storage y editor |
| Linux/macOS | Build cuando exista runner compatible |
| iOS | Sync/build/smoke solo en macOS con Xcode |

BlockNote se prueba en WebView2 y Android WebView. WKWebView pasa a gate cuando exista entorno iOS. Cubrir IME, touch, clipboard, selection, teclado, scroll, dialogs, safe areas y documentos grandes.

## React y rendimiento

Verificar que editor/Mantine estan en chunk lazy, auth inicializa antes de vistas privadas, logout limpia caches/stores, listeners no se duplican y queries independientes no forman waterfalls. Features no deben importar SDK nativo.

## Gates

Tipos, lint, unitarias, RLS, E2E web, build Vite, Tauri Windows y Capacitor Android son obligatorios. Targets condicionados se registran como no verificados, no como aprobados. Timer, lifecycle, drafts, autosave, proyeccion y seguridad requieren cobertura de riesgo.
