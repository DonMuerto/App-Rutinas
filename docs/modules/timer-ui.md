# Modulo runtime y UI del temporizador

## Objetivo

Mantener una sesion por contexto de ejecucion y representarla en overlay React desde editor o Hoy. No usa Fullscreen API.

## Responsabilidades

- Montar controller/store por encima de las rutas privadas.
- Iniciar desde un snapshot inmutable.
- Bloquear atomicamente un segundo Start.
- Abrir el overlay de enfoque al iniciar y permitir volver al timer existente.
- Solicitar ticks visuales y entregar timestamps al motor.
- Mostrar titulo, rutina, fase, restante, ciclo, set y anillo.
- Emitir señal visual y audio en transiciones.
- Cancelar una sesion running y descartar una sesion done.
- Persistir snapshot con TimerStoragePort y reconciliar en resume/reinicio.

## No objetivos

- No coordinar contextos o dispositivos.
- No pausar, reanudar, saltar o reiniciar.
- No editar configuracion en modo enfoque.
- No completar Activity.
- No pedir permisos ni implementar capacidades PWA.

## Comportamiento

Start prepara audio como consecuencia del gesto del usuario, crea la sesion y abre el overlay. Si existe una sesion running o done, se rechaza sin reemplazarla.

En background no intenta ejecutar ticks. Al volver adopta la fase calculada y reproduce como maximo un sonido. Un fallo de AudioPort nunca detiene la sesion.

Cancel cierra, libera y elimina snapshot sin completion. Done ocupa hasta Dismiss. Recargar/reiniciar restaura un snapshot valido del mismo usuario.

## Accesibilidad

El modo enfoque tiene semantica modal, nombre accesible, foco contenido y controles por teclado. La fase y el tiempo existen como texto; el anillo no es la unica representacion. Una region viva anuncia cambios de fase, no cada tick. `prefers-reduced-motion` elimina animacion continua no esencial sin alterar datos.

Trabajo usa ambar y descansos salvia, siempre junto a etiquetas. Los numeros usan cifras tabulares.

## Aceptacion del modulo

- Editor y Hoy abren el mismo singleton.
- Navegar no reinicia la sesion.
- Start doble crea una sola sesion.
- Throttling no introduce deriva acumulada.
- Audio bloqueado conserva señal visual.
- Cancel y done no escriben completion.
- Dismiss libera el singleton.
- No se registra Service Worker ni se solicitan permisos.

## Handoff

Entregar provider/controller, overlay, TimerRing e integraciones LifecyclePort, AudioPort y TimerStoragePort. No importar Tauri/Capacitor.
