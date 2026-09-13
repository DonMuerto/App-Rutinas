# Modulo del bloque Activity

## Objetivo

Implementar Activity como bloque custom dentro del flujo del documento. Debe parecer una linea enriquecida, no una tarjeta ni un formulario separado.

## Anatomia

- Checkbox diario.
- Icono de reloj y hora opcional.
- Titulo inline editable.
- Resumen de countdown o intervalos.
- Accion Start cuando la configuracion es valida.
- Acceso a configuracion contextual.

El panel es popover en escritorio y puede convertirse en sheet/dialog adaptado en movil. Sigue perteneciendo al editor; no existe ruta de edicion.

## Edicion

- Insertar desde `/` usa los defaults del contrato documental.
- El titulo admite el contenido inline soportado por el esquema.
- La hora usa formato de 24 horas y se puede quitar.
- Elegir `none`, `countdown` o `interval` no elimina valores inactivos.
- Configuracion incompleta puede permanecer en el documento, pero Start queda deshabilitado.
- La UI usa stepper y entrada accesible. Countdown avanza en pasos de 60 segundos; duraciones de fase en pasos de 5 segundos; ciclos y sets en pasos de uno.
- Nunca permitir que un stepper salga de los rangos contractuales.

## Duracion resumida

Countdown muestra su duracion. Intervalos suman preparacion, todos los trabajos, descansos entre ciclos aplicables y descansos entre sets aplicables. No cuentan descansos finales inexistentes.

## Comandos

Toggle completion envia rutina, Activity como ambito y objetivo, y fecha local. Start entrega al timer global un snapshot del titulo plano, rutina, bloque y configuracion normalizada. Si hay otro timer, no lo reemplaza y ofrece volver a su modo enfoque.

## Casos limite

- Una Activity vacia usa fallback visual no persistido.
- Una hora invalida se marca para correccion y se proyecta sin hora.
- Duplicar genera IDs nuevos para Activity y descendientes.
- Editar o eliminar despues de Start no altera la sesion activa.
- Una Activity anidada no puede crearse desde la UI; datos existentes delimitan un nuevo ambito de subtareas.

## Accesibilidad

Checkbox, Start, hora y configuracion tienen nombres accesibles. Los botones de stepper anuncian magnitud, unidad y valor. El estado no depende solo de color. El foco permanece predecible al abrir y cerrar el panel. Controles tactiles esenciales alcanzan 44 px.

## Handoff

Entregar registro/schema del bloque, render editable, panel responsive, validacion, resumen de duracion y adaptadores hacia completions y timer. El owner del editor conserva el archivo de ensamblaje; coordinar el punto de integracion sin editarlo simultaneamente.
