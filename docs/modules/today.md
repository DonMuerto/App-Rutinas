# Modulo de la vista Hoy

## Objetivo

Presentar Activities de las rutinas aplicables a la fecha local para completar, ejecutar o abrir su origen, sin editar documentos.

## Responsabilidades

- Calcular y mostrar la fecha local vigente.
- Solicitar rutinas diarias y especificas coincidentes.
- Proyectar Activities y subtareas mediante el contrato compartido.
- Asociar completions de la misma fecha.
- Ordenar de forma determinista.
- Permitir toggle de Activity y subtarea.
- Iniciar timer valido o volver al activo.
- Navegar a rutina+Activity ID.
- Reconsultar al cruzar medianoche o recuperar foco con otra fecha.

## No objetivos

- No montar un editor ni guardar `routines.content`.
- No editar nombre, hora, timer, recurrencia, subtareas u orden.
- No iniciar por hora automaticamente.
- No mostrar calendario, rachas o historial.

## Orden

1. Hora valida ascendente.
2. Actividades sin hora al final.
3. Posicion de rutina.
4. Orden documental.
5. `routineId` y Activity ID como desempate.

El orden visual no escribe ningun dato.

## Estados

- Carga inicial con estructura estable.
- Vacio real cuando no hay Activities aplicables.
- Error total de consulta.
- Diagnostico parcial cuando un documento contiene datos invalidos.
- Mutacion de completion pendiente y rollback.
- Timer ocupado con accion para abrirlo.

Una Activity invalida puede mostrarse y navegarse, pero no iniciar timer. Una Activity sin titulo usa fallback visual no persistido. Rutinas sin Activities no crean grupos vacios.

## Responsive y accesibilidad

La pagina identifica Hoy y su fecha. Cada fila asocia actividad, rutina, hora y completion. Las subtareas usan semantica de lista y profundidad perceptible. El orden visual coincide con tab order. En movil las acciones siguen disponibles sin scroll horizontal.

## Aceptacion del modulo

- Incluye todas las diarias y solo las especificas coincidentes.
- No utiliza fecha UTC ni fecha del servidor.
- Ordena actividades con y sin hora de forma estable.
- Muestra completions iguales a las del editor.
- Solo expone completar, iniciar/abrir timer y navegar.
- Ninguna accion propia actualiza el documento.
- Un cambio de dia refresca seleccion y checks sin cancelar timer.

## Handoff

Entregar ruta, read model, componentes read-only, orden, integraciones y pruebas con fixtures de distintas fechas y zonas. Consumir extractor de editor y repositorios de datos sin duplicarlos.
