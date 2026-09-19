# Handoff M3: timer y lifecycle

## Identidad

- Sesion/rol: M3, timer y lifecycle multiplataforma.
- Ola/gate: Ola 1; API publica, runtime y UI de enfoque completados. Integracion global de M0 pendiente.
- Owner receptor: M0 para integracion y lock; M2/M4 para consumir el controller; M5 para E2E y smoke nativo.
- Base commit y estado de worktree: checkpoint M0 `dd1677d5fb6079b4a8c528992dbb9f66ed7a1ef6`; worktree compartido y sucio por migracion M0 y cambios concurrentes. No se revirtio ningun cambio ajeno.

## Cambios

- Archivos creados/modificados: `packages/timer/package.json`; `packages/timer/README.md`; `packages/timer/src/context.ts`; `packages/timer/src/controller.ts`; `packages/timer/src/engine.ts`; `packages/timer/src/index.ts`; `packages/timer/src/provider.tsx`; `packages/timer/src/snapshot.ts`; `packages/timer/src/timer-surface.tsx`; `packages/timer/src/timer.module.css`; `packages/timer/src/use-timer.ts`; `packages/timer/src/validation.ts`; pruebas de engine, validation, snapshot, controller y superficie React.
- Ownership y transferencias: M3 posee `packages/timer/**`; M2/M4 reciben controller, hook y superficie sin importar implementaciones de plataforma. `TimerProvider` monta la UI; M0 solo debe montar el provider en la composicion privada cuando integre.
- Dependencias solicitadas a M0: registrar `packages/timer` en el importer del `pnpm-lock.yaml`, resolver su dependencia workspace de `@ritmo/core`/`@ritmo/platform` y validar la resolucion unica de React 19.1.1 con `react-dom` 19.1.1 en el cliente. No se agregaron paquetes externos ni se modifico `package.json` raiz.
- Cambios concurrentes preservados: se conservaron los cambios M0/M1/M2/M4 del workspace. El lockfile ya estaba modificado por M0; se retiro un importer temporal de `packages/timer` creado al enlazar dependencias localmente para que M0 lo publique de forma canonica.

## Contratos

- Documentos consumidos: `AGENTS.md`, vision y alcance MVP, handoff M0, ADR 0002, arquitectura general y React multiplataforma, `docs/contracts/timer.md`, `docs/contracts/platform.md`, `docs/database/time-semantics.md`, `docs/modules/timer-engine.md`, `docs/modules/timer-ui.md`, plan, aceptacion y testing. La UI del checkpoint `dd1677d` se uso solo como referencia historica.
- API publica entregada: `@ritmo/timer` exporta `validateRunnableTimerConfig`, `parseRunnableTimerConfig`, `buildTimerPlan`, `startTimer`, `tickTimer`, `cancelTimer`, `createTimerEngine`, `serializeTimerSnapshot`, `deserializeTimerSnapshot`, `restoreTimerSnapshot`, `createTimerController`, `TimerProvider`, `TimerSurface`, `useTimer` y sus tipos. La API headless de controller/hook y las props existentes del provider conservan compatibilidad; el provider ahora agrega la superficie visual.
- Controller: recibe `LifecyclePort`, `TimerStoragePort`, `AudioPort`, `userId`, `contextId` y reloj opcional. Expone `ready`, `start`, `tick`, `restore`, `cancel`, `dismiss`, `logout`, `openFocus`, `closeFocus`, suscripcion de store y snapshot server-safe. La restauracion inicial se encola antes de aceptar operaciones para impedir que un Start inmediato reemplace un snapshot valido. Payloads incompletos se clasifican como corruptos antes de evaluar mismatch de identidad.
- Persistencia: Start y transiciones guardan envelope versionado; Cancel/Dismiss eliminan el contexto; logout limpia todos los snapshots del usuario; restart/resume valida y reconcilia con el timestamp actual.
- Cambios propuestos: ninguno.
- Supuestos: una instancia de `TimerController` se monta por contexto de ejecucion; M0/M4 deben compartirla entre editor y Hoy. M3 entrega overlay, anillo y dock dentro del provider; M2/M4 solo conectan Start/Open mediante la API publica.

## Verificacion

- Tipos, lint, unitarias y build: `npm test -- --run packages/timer` paso con 5 archivos y 39 pruebas; `npm exec -- tsc --noEmit --pretty false` paso; `npm exec -- eslint packages/timer --max-warnings=0` paso; `npm exec -- prettier --check packages/timer` paso; `npm exec --yes pnpm@10.17.1 -- build` paso Vite.
- Pruebas de componente: 3 casos cubren intervalos running y anuncio de fase, cierre/dock/reapertura, trap y retorno de foco, Escape, done y Dismiss. Se ejecutaron tambien de forma aislada con `npm test -- --run packages/timer/src/timer-surface.test.tsx`.
- Suite global: no se ejecuto en esta iteracion; la suite enfocada completa de `packages/timer` pasa.
- Typecheck global: paso sin diagnosticos.
- Lint global: no se ejecuto; el lint enfocado de `packages/timer` pasa sin errores ni warnings.
- RLS/E2E si aplica: M3 no accede a Supabase ni RLS. E2E web y native smoke quedan para M5/M0 despues de montar el provider.
- Web/Tauri/Capacitor ejecutados: build Vite web paso. No se ejecuto Tauri build/smoke ni Capacitor Android porque M0 no los cerro en este entorno y M3 no modifica shells.
- Plataformas no verificadas y motivo: Tauri Windows requiere Rust/MSVC/Windows SDK; Android requiere Java/emulador; iOS requiere macOS/Xcode.
- Evidencia visual/dispositivo: jsdom verifica semantica modal, textos alternativos a color, progreso, foco, teclado, dock y acciones. Falta inspeccion visual y lector de pantalla en navegador/WebView real.

## Riesgos

- Casos limite: countdown, intervalos con preparacion/ciclos/sets/descansos, fases cero, deadline exacto, salto de varias fases, suspension larga, rollback de reloj, cancelacion, snapshot running/done, snapshot corrupto/nulo/versionado, mismatch de usuario/contexto, restore tras reinicio, Start doble serializado, persistencia de transiciones, limpieza Cancel/Dismiss/logout y AudioPort fallido.
- Limitaciones y bloqueos: cambios bruscos manuales del reloj no se corrigen adicionalmente; el sonido puede fallar y la señal visual/textual queda como fuente alternativa; el provider no ejecuta ticks en background y requiere una instancia estable sobre las rutas privadas. El workspace aun no contiene importer de `packages/timer` en `pnpm-lock.yaml` ni montaje en `apps/client`, ambos fuera del ownership M3.
- Trabajo diferido: M0 agrega el importer/lock y monta `TimerProvider`; M2/M4 reemplazan adaptadores temporales y conectan Start/Open focus; M5 añade E2E de resume/restore, responsive/contraste/lector de pantalla y smoke WebView/Tauri/Android.

## Confirmaciones

- Sin `any` injustificado ni secretos/service role.
- Sin RLS debilitada, paquetes XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Sin Activity separada del editor.
- Sin imports Tauri/Capacitor/Supabase en `packages/timer`.
- Sin Next/SSR nuevo en la arquitectura objetivo.
- Sin pausa, skip, reset ni completion automatica.
- Sin modificaciones de apps/UI ajena ni contratos documentales.
