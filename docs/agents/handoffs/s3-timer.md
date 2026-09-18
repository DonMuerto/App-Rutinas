# Handoff S3: motor y UI de timer

> Handoff historico web. El engine es material reutilizable; persistencia/lifecycle se rigen por ADR 0002 y M3.

## Identidad

- Sesion: S3.
- Rol: motor y UI de timer.
- Alcance terminado: validador ejecutable, motor temporal puro, singleton por pestana, provider, modo enfoque, TimerRing, audio y accesibilidad.
- Owner receptor: S2, S4, S5 y S6.
- Ola/gate: handoff parcial de API publica y vertical S3 terminada; integracion global pendiente.

## Cambios

- Archivos creados: `lib/timer/audio.ts`, `lib/timer/engine.ts`, `lib/timer/index.ts`, `lib/timer/store.ts`, `lib/timer/validation.ts`, sus pruebas y `lib/timer/README.md`; `components/timer/index.ts`, `components/timer/timer-provider.tsx`, `components/timer/timer-overlay.tsx`, `components/timer/timer-dock.tsx`, `components/timer/timer-ring.tsx`, `components/timer/timer.module.css` y pruebas del provider.
- Archivos modificados: `AGENTS.md`, por solicitud explicita del usuario, para exigir la publicacion continua de handoffs en `docs/agents/handoffs/`.
- Archivos compartidos tocados con autorizacion: `AGENTS.md`.
- Dependencias solicitadas o agregadas por S0: ninguna; se uso Web Audio nativo.

## Contratos

- Contratos consumidos: `docs/contracts/domain.md`, `docs/contracts/document-schema.md`, `docs/contracts/timer.md`, `docs/database/time-semantics.md`, `docs/modules/timer-engine.md` y `docs/modules/timer-ui.md`.
- API publica entregada: `@/lib/timer` exporta `timerConfigSchema`, `validateRunnableTimerConfig`, `parseRunnableTimerConfig`, plan, estados, transiciones, `createTimerEngine`, `timerStore` y tipos; `@/components/timer` exporta `TimerProvider`, `useTimer`, `TimerRing` y la frontera necesaria para Start.
- Resultado de Start: `{ ok: true }`, rechazo `invalid` con issues o rechazo `occupied` con la sesion existente. Un rechazo nunca reemplaza el singleton.
- Ejemplo de consumo: `lib/timer/README.md`.
- Cambios de contrato propuestos: ninguno.
- Supuestos adoptados: cerrar el overlay solo cierra la representacion de enfoque y no es un comando temporal; la sesion continua disponible mediante Open focus.

## Verificacion

- Comandos ejecutados: `npm test -- --run lib/timer components/timer`, `npm exec -- eslint lib/timer components/timer --max-warnings=0`, `npm exec -- prettier --check lib/timer components/timer`, `npm test -- --run`, `npm run typecheck` y `npm run build`.
- Resultado de tipos del modulo: sin diagnosticos S3. El typecheck global mas reciente queda bloqueado por errores concurrentes en `components/today/**`, `lib/today/**` y, durante una ejecucion, `lib/blocknote/**`/`components/sidebar/**`.
- Resultado de lint del modulo: exit code 0, sin errores ni warnings. El lint global queda bloqueado por warnings preexistentes en `.agents/**`.
- Resultado de pruebas del modulo: exit code 0; 4 archivos y 39 pruebas aprobadas.
- Resultado de pruebas globales mas reciente: 67 aprobadas, 2 fallidas en `components/today/today-view.test.tsx` y 1 prueba RLS omitida por su entorno.
- Resultado de formato del modulo: exit code 0; todos los archivos S3 cumplen Prettier. El formato global queda bloqueado por `.agents/**` y archivos concurrentes fuera de S3.
- Resultado de build: la compilacion optimizada termina correctamente; la validacion TypeScript posterior queda bloqueada por errores concurrentes de S4 en `components/today/today-view.tsx` y `lib/today/order.test.ts`.
- Evidencia adicional RLS/E2E/visual: no se accede a datos ni RLS desde S3. Las pruebas de componentes verifican modal, foco contenido/restaurado, navegacion cliente, visibility recovery, audio bloqueado, señal visual y anuncios distinguibles. E2E transversal queda para S6 tras integrar verticales.

## Riesgos

- Casos limite cubiertos: countdown, intervalos completos, preparacion unica, fases opcionales cero, ciclos y sets, ausencia de descanso final, deadline exacto, salto de una o varias fases, suspension, final tardio, retroceso del reloj, configuraciones negativas/decimales/infinitas/fuera de rango, cancelacion en cada fase, Start doble, done ocupado, snapshot inmutable y audio bloqueado.
- Limitaciones conocidas: la sesion se pierde al recargar o cerrar; el cambio manual brusco del reloj no recibe compensacion adicional; el sonido depende de las politicas del navegador.
- Trabajo diferido: S5 debe montar `TimerProvider` una vez por encima de las rutas privadas; S2 y S4 deben reemplazar adaptadores temporales por `useTimer`; S6 debe cubrir E2E integrado y revision visual responsive.
- Bloqueos para consumidores: ninguno en la API S3. Los gates globales dependen de estabilizar los cambios concurrentes indicados en Verificacion.

## Confirmaciones obligatorias

- No se uso `any` injustificado.
- No se introdujo `SUPABASE_SERVICE_ROLE_KEY`.
- No se debilito RLS.
- No se agregaron paquetes `@blocknote/xl-*`.
- No se implemento PWA, Service Worker, Web Notifications o Wake Lock.
- No se uso Fullscreen API; el modo enfoque es un overlay del viewport.
- No se creo una pantalla de edicion de Activity.
- No se agregaron pausa, skip, reset ni persistencia del timer.
- Ninguna transicion inicia, cancela o finaliza completions.
- No se modificaron archivos fuera del ownership salvo `AGENTS.md`, autorizado expresamente por el usuario.
