# Modulo de rutinas y editor

## Objetivo

Ofrecer la pagina principal de Ritmo: una rutina editable como documento BlockNote completo, con metadatos discretos y bloque Activity registrado.

## Responsabilidades

- Cargar una rutina accesible desde `/rutinas/[routineId]`.
- Editar `routines.name` como encabezado fuera del documento, sin copia oculta.
- Editar icono y recurrencia.
- Inicializar BlockNote con `routines.content` y el esquema custom.
- Mantener slash menu, Enter, Backspace, Tab/Shift+Tab, drag and drop, copy/paste y undo/redo soportados por BlockNote.
- Guardar texto, props, estructura, orden e IDs estables.
- Integrar Activity, completion diaria y timer mediante APIs publicas.
- Abrir y enfocar una Activity solicitada por enlace desde Hoy.

## No objetivos

- No modelar bloques como filas.
- No implementar jerarquia de rutinas.
- No interpretar todas las rutinas para Hoy.
- No construir colaboracion en tiempo real.
- No implementar motor ni SQL dentro del editor.
- No usar paquetes BlockNote XL.

## Carga y guardado

Un documento vacio abre una superficie utilizable. El autosave usa un debounce inicial de 750 ms; el valor puede ajustarse por evidencia, no por preferencia. Los estados visibles son sin cambios, cambios pendientes, guardando, guardado y error.

La navegacion cliente bloquea el cambio hasta vaciar el guardado pendiente o mostrar un error. Cerrar/recargar con cambios pendientes activa una advertencia nativa; si el usuario confirma salir, la posible perdida es una limitacion aceptada. Un error conserva la edicion local y permite reintentar.

La mutacion de contenido nunca envia `name`, recurrencia o posicion. El MVP acepta ultima escritura entre pestanas y documenta que no hay merge concurrente.

## Recurrencia

Elegir diaria limpia la fecha especifica. Elegir fecha especifica exige una fecha civil valida antes de guardar. La rutina permanece en el sidebar y editable fuera de esa fecha.

## Completions en el editor

Al montar, el navegador calcula la fecha local y carga completions. Activity y checklists descendientes muestran ese estado externo. Checklists fuera de Activity usan el estado normal del documento.

El agente debe completar un spike antes de integrar. La opcion preferida controla o decora el check nativo sin mutar el documento. El fallback aceptado mantiene una representacion efimera y normaliza `checked` a falso antes de persistir. Ambas opciones deben demostrar que texto, estructura, undo/redo y autosave permanecen correctos. Si ninguna funciona, debe detenerse; no puede crear silenciosamente otro tipo de subtarea.

## Enlace de origen

Despues de inicializar el editor, se busca el ID solicitado. La opcion preferida coloca foco mediante API publica de BlockNote. El fallback aceptado hace scroll, aplica resaltado temporal y mueve foco al editor adyacente sin usar internals inestables. Si no existe, la rutina sigue abierta y se informa que el bloque cambio o fue eliminado.

## Aceptacion del modulo

- Renombrar actualiza solo `name` y se refleja en sidebar y Hoy.
- Guardar y recargar conserva estructura, props e IDs.
- `/` inserta Activity y los bloques estandar esperados.
- Subtareas diarias cambian de fecha sin perder texto.
- Checklists normales mantienen su estado.
- Un fallo de autosave es visible y no descarta contenido.
- Un enlace valido desde Hoy localiza la Activity.

## Handoff

Entregar wrapper BlockNote, adaptadores de documento, autosave, ruta de rutina, integraciones publicas y pruebas. Documentar resultado de los spikes de completion diaria y foco por ID. No modificar internals de timer ni repositorios.
