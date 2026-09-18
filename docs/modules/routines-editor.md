# Modulo de rutinas y editor

## Objetivo

Ofrecer la superficie principal React/BlockNote en navegador y WebViews con el mismo documento y comportamiento.

## Responsabilidades

- Cargar una rutina accesible desde `#/rutinas/:routineId`.
- Editar `routines.name` como encabezado fuera del documento, sin copia oculta.
- Editar icono y recurrencia.
- Inicializar BlockNote con `routines.content` y el esquema custom.
- Mantener slash menu, Enter, Backspace, Tab/Shift+Tab, drag and drop, copy/paste y undo/redo soportados por BlockNote.
- Guardar texto, props, estructura, orden e IDs estables con revision.
- Escribir un draft local atomico antes del autosave remoto.
- Responder a background, close-requested y back-requested mediante LifecyclePort.
- Integrar Activity, completion diaria y timer mediante APIs publicas.
- Abrir y enfocar una Activity solicitada por enlace desde Hoy.

## No objetivos

- No modelar bloques como filas.
- No implementar jerarquia de rutinas.
- No interpretar todas las rutinas para Hoy.
- No construir colaboracion en tiempo real ni offline-first.
- No implementar motor ni SQL dentro del editor.
- No usar paquetes BlockNote XL.

## Carga y guardado

Un documento vacio abre una superficie utilizable. El autosave usa debounce de 750 ms, generacion monotona y maximo un save en vuelo. Cada cambio actualiza draft local y luego guarda con revision esperada. Un exito viejo no puede borrar un draft nuevo.

Navegacion intenta flush. Background/cierre persiste draft sin asumir red. Conflicto ofrece recargar remoto o crear una rutina nueva con el draft. Fallo de DraftStorage activa estado critico y bloquea salida. Exito elimina solo la generacion guardada.

La mutacion de content nunca envia `name`, recurrencia o posicion. No hay merge automatico; revision evita ultima escritura silenciosa.

## Recurrencia

Elegir diaria limpia la fecha especifica. Elegir fecha especifica exige una fecha civil valida antes de guardar. La rutina permanece en el sidebar y editable fuera de esa fecha.

## Completions en el editor

Al montar o reanudar, el dispositivo calcula fecha y carga completions. Activity y descendientes muestran estado externo; checklists normales usan documento.

El spike web existente se repite en WebView2 y Android WebView, y en WKWebView cuando haya runner. Debe cubrir touch, IME, teclado virtual, clipboard, undo/redo, scroll, foco, dialogs y memoria. Si la interceptacion DOM no es estable, se bloquea release; no se crea otro editor.

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

Entregar paquete editor independiente del router, draft controller, autosave revisionado, Activity y matriz WebView. No importar SDKs nativos ni Supabase directo.
