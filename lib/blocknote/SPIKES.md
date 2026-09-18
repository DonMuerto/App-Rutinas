# Spikes BlockNote de S2

> Evidencia historica del runtime web/Next. ADR 0002 exige repetir estos spikes en la arquitectura Vite y en WebView2/Android WebView; WKWebView queda pendiente hasta disponer de macOS/Xcode. Los resultados DOM siguientes no prueban compatibilidad movil por si solos.

Version evaluada: `@blocknote/core`, `@blocknote/react` y
`@blocknote/mantine` 0.54.2.

## Completion diaria de checklist

El render nativo de `checkListItem` escucha `change` y ejecuta
`editor.updateBlock(block, { props: { checked } })`. La prueba con BlockNote real
confirma que un click cambia `editor.document`, dispara `onChange` y crea una
entrada de undo, sin distinguir si la checklist desciende de Activity.

La integracion adoptada intercepta el click en capture desde `BlockNoteView`
solo cuando `editor.getParentBlock()` encuentra una Activity. En ese caso evita
el listener nativo, envia la clave diaria a `CompletionStore` y superpone el
estado de cache asignando `HTMLInputElement.checked`. No llama `updateBlock`, no
dispara `onChange` y no agrega estado diario al historial editorial. Las
checklists fuera de Activity conservan el comportamiento nativo.

Como defensa adicional, el snapshot de autosave pasa por
`normalizeActivityChecklists()`, que copia el documento y fuerza `checked: false`
solo dentro del ambito Activity. Texto, estructura, props restantes e IDs no se
modifican.

Evidencia reproducible:

```text
vitest run components/editor/blocknote-spikes.test.tsx
BlockNote completion spike: 2 pruebas aprobadas
```

## Foco por ID

BlockNote 0.54.2 publica `editor.getBlock(id)`,
`editor.setTextCursorPosition(block, "start")` y `editor.focus()`. Estas APIs
encuentran tambien bloques anidados y colocan el cursor, pero no garantizan
scroll por si solas. La integracion localiza el elemento publico `[data-id]` y
usa `scrollIntoView({ block: "center", inline: "nearest" })`, respetando
`prefers-reduced-motion`.

La solicitud se ejecuta despues del montaje mediante `requestAnimationFrame` y
un segundo intento acotado. Un ID ausente o duplicado abre la rutina sin romperla
y anuncia que la Activity cambio o fue eliminada.

Evidencia reproducible:

```text
vitest run components/editor/blocknote-spikes.test.tsx
BlockNote focus and identity spike: 2 pruebas aprobadas
```

## Riesgo de version

La superposicion depende del DOM publico de BlockNote (`data-id`,
`data-content-type="checkListItem"` y el input nativo). La prueba de spike es una
regresion obligatoria antes de actualizar BlockNote. No se usan internals de
ProseMirror ni paquetes XL.

## Matriz multiplataforma pendiente

Para cada WebView registrar version, SO y resultado de: touch/click de checklist, IME, teclado virtual, selection handles, clipboard rich text, Tab/indent alternativo, undo/redo, popovers/dialogs, scroll al ID, safe areas, documento grande y resume tras suspension. Un target no ejecutado se marca pendiente.
