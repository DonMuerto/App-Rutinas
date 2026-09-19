# Handoff M5: calidad y release

## Identidad

- Sesion/rol: M5, calidad y release.
- Ola/gate: Ola 1, matriz de calidad y harnesses de release.
- Owner receptor: M0 para integracion final y coordinacion; M1 para el gate RLS; M2 para el formato pendiente de su test.
- Base commit y estado de worktree: checkpoint local `dd1677d5fb6079b4a8c528992dbb9f66ed7a1ef6` (`chore: checkpoint Next implementation before Vite migration`), sin push. El worktree conserva la migracion M0-M4 concurrente sin commit y los cambios M5.

## Cambios

- Archivos creados/modificados: `tests/e2e/foundation.spec.ts`, `tests/smoke/README.md`, `tests/smoke/tauri-smoke.ps1`, `tests/smoke/android-smoke.sh`, `.github/workflows/quality.yml` y este handoff.
- Ownership y transferencias: M5 toma los smoke/E2E y workflows. M0 debe conectar `packages/data-auth`, `document-model`, `editor`, `timer`, `features` y `ui` desde `apps/client` antes de habilitar los flujos MVP completos.
- Dependencias solicitadas a M0: ninguna. Los harnesses usan Playwright, pnpm, Tauri CLI, Gradle/adb y Supabase CLI ya declarados o disponibles en los runners; no se agregaron paquetes ni se modificaron manifests/lockfile.
- Cambios concurrentes preservados: no se tocaron `packages/**`, `supabase/tests/**`, migraciones, apps ni configuracion raiz fuera del workflow y tests M5.

## Contratos

- Documentos consumidos: `AGENTS.md`, ADR 0002, arquitectura React multiplataforma, contrato de plataforma, modulos de shells/editor/timer/auth/Hoy, testing, acceptance, deployment, plan y handoffs M0-M4.
- API publica entregada: no se modificaron APIs de producto. Se entregan los comandos `tests/smoke/tauri-smoke.ps1` y `tests/smoke/android-smoke.sh` como harnesses de release.
- Cambios propuestos: ninguno a contratos. El smoke Android compara todos los assets Vite con los assets sincronizados, excluyendo solo `cordova.js` y `cordova_plugins.js`, que Capacitor genera como puente.
- Supuestos: el workflow de RLS obtiene unicamente el anon key local filtrado por nombre; nunca exporta ni usa service role. Tauri consume `dist` mediante `frontendDist` y Capacitor mediante `webDir`.

## Verificacion

- Tipos, lint, unitarias y build: `typecheck` paso; `lint` paso; `pnpm test` paso con 22 archivos y 111 pruebas; build Vite paso. `format` queda bloqueado unicamente por `packages/editor/src/react/editor-react.test.tsx`, fuera de ownership M5.
- RLS/E2E si aplica: invariantes de migracion pasaron (5 pruebas). La suite dinamica RLS publicada por M1 quedo omitida/skipped porque no existen Docker, Docker Desktop, Podman ni Supabase CLI local. E2E Playwright paso 10/10, y 20/20 con `--repeat-each=2`; cubre el scaffold existente, HashRouter, recarga, runtime web, responsive 360/768/1440, landmarks y ausencia de registros Service Worker.
- Web/Tauri/Capacitor ejecutados: build Vite, E2E Chromium desktop/mobile, `cap sync`, `cap doctor android` y `tauri info` ejecutados. Los assets Vite sincronizados a Android coinciden con `dist`; Capacitor agrega solo sus dos archivos puente Cordova.
- Plataformas no verificadas y motivo: Tauri build/runtime no ejecutado por falta de Rust, Cargo, MSVC y Windows SDK; WebView2 si esta disponible. Android build/emulador/runtime no ejecutado por falta de Java, Android SDK y dispositivo. iOS/macOS no verificados por falta de macOS/Xcode. RLS real no verificada por falta de contenedores/CLI.
- Evidencia visual/dispositivo: Chromium verifico la pantalla de fundacion en 360, 768 y 1440 px; no hubo WebView2 real, Android ni iOS. El flujo auth/editor/Hoy/timer/drafts completo no puede ejecutarse porque `apps/client/src/app.tsx` aun monta la pantalla de fundacion de M0.

## Riesgos

- Casos limite: el E2E actual no cubre auth, Activity, autosave/conflictos, Hoy, completions, timer restore, logout ni secure storage porque la composicion M0 aun no los expone. Los harnesses nativos si cubren build/arranque de shell cuando se ejecutan en runners adecuados, pero requieren ampliar las aserciones despues de integrar las rutas.
- Limitaciones y bloqueos: release bloqueado hasta integrar M1-M4 en `apps/client`, ejecutar RLS A/B/anon real, ejecutar Tauri Windows y Android con WebViews, y corregir el formato de `packages/editor/src/react/editor-react.test.tsx`. No se declara Apple aprobado.
- Trabajo diferido: M0 integra providers/rutas lazy y los adapters; M1 ejecuta RLS en CI/local Supabase; M2/M3/M4 habilitan los escenarios MVP; despues M5 amplia el E2E a la matriz de producto y repite smoke WebView2/Android.

## Confirmaciones

- Sin `any` injustificado ni secretos/service role agregados por M5.
- Sin RLS debilitada, paquetes XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Sin Activity separada del editor.
- Sin imports Tauri/Capacitor fuera de adaptadores; los tests solo inspeccionan shells.
- Sin Next/SSR nuevo en la arquitectura objetivo.
- Sin modificaciones fuera de ownership no coordinadas.
