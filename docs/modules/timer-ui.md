# Modulo runtime y UI del temporizador

## Objetivo

Mantener una sola sesion temporal por pestana y representarla en un overlay modal que ocupa el viewport, tanto si se inicia desde el editor como desde Hoy. No usa Fullscreen API ni solicita permiso de pantalla completa.

## Responsabilidades

- Montar el store por encima de las rutas privadas para sobrevivir navegacion cliente.
- Iniciar desde un snapshot inmutable.
- Bloquear atomicamente un segundo Start.
- Abrir el overlay de enfoque al iniciar y permitir volver al timer existente.
- Solicitar ticks visuales y entregar timestamps al motor.
- Mostrar titulo, rutina, fase, restante, ciclo, set y anillo.
- Emitir señal visual y audio en transiciones.
- Cancelar una sesion running y descartar una sesion done.

## No objetivos

- No persistir al recargar ni coordinar pestanas.
- No pausar, reanudar, saltar o reiniciar.
- No editar configuracion en modo enfoque.
- No completar Activity.
- No pedir permisos ni implementar capacidades PWA.

## Comportamiento

Start prepara audio como consecuencia del gesto del usuario, crea la sesion y abre el overlay. Si existe una sesion running o done, se rechaza sin reemplazarla.

Al volver de una suspension, la UI adopta inmediatamente la fase calculada. Si se omitieron varias transiciones, muestra el estado correcto y reproduce como maximo un sonido. Un fallo de audio nunca detiene la sesion.

Cancel cierra y libera sin completion. Al llegar a done, el singleton sigue ocupado hasta Dismiss. Recargar pierde la sesion y esta limitacion debe ser aceptada.

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

Entregar provider/store, overlay, TimerRing, adaptador de audio, integracion con motor y pruebas de singleton, foco, navegacion y suspension simulada.
