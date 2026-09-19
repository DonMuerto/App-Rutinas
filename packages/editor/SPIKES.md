# Spikes BlockNote M2

## Navegador

La implementacion historica en Chromium confirmo con BlockNote 0.54.2 que la
checklist nativa escribe `checked` y crea una transaccion undo, mientras que la
intercepcion capture bajo Activity puede mantener ese valor fuera del documento.
Tambien confirmo foco por `getBlock`, `setTextCursorPosition` y `focus`, con
`[data-id]` solamente como fallback de scroll probado por version.

M2 conserva ambos comportamientos en pruebas de componente Vite. Cualquier
actualizacion de BlockNote debe repetirlas antes de integrar.

## WebViews

- WebView2 Windows: no verificado en este entorno; requiere runner Windows.
- Android WebView: no verificado; no hay Java/emulador/dispositivo disponible.
- WKWebView: no declarado ni verificado; requiere macOS y Xcode.

El gate nativo debe cubrir touch, IME, teclado virtual, clipboard, undo/redo,
indentacion, drag, scroll/foco, dialog, safe areas, resume y memoria con
documentos grandes. Si los selectores DOM de checklist dejan de ser estables,
el release se bloquea; no se sustituye BlockNote.
