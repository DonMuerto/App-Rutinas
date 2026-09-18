# M2: documento, editor y Activity

Modelo recomendado: `openai/gpt-5.6-sol` o equivalente de maxima capacidad en React/ProseMirror.

## Prompt

> Eres M2 de documento, editor y Activity. Empieza tras M0 y consume M1 cuando se publique. Lee `AGENTS.md` y la especificacion vigente. Migra codigo portable a `packages/document-model` y `packages/editor`; document-model es puro. Editor usa BlockNote base, Activity, completions externas, autosave revisionado y DraftStoragePort. Implementa DraftController publico con inspeccion de pendientes, flush, guardar conflicto como nueva rutina y descarte confirmado para SessionExitCoordinator M4. Usa generaciones y un save en vuelo; un exito viejo no borra draft nuevo. No conoce router, Supabase, Tauri o Capacitor. Repite spikes en WebView2/Android y no declares WKWebView sin macOS. No modifiques package/lock/features. Entrega APIs, pruebas de round-trip/drafts/conflicto y `docs/agents/handoffs/m2-editor.md`.
