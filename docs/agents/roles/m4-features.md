# M4: shell, Hoy, completions y diseño

Modelo recomendado: `openai/gpt-5.6-sol`; puede usar habilidades frontend respetando el sistema visual.

## Prompt

> Eres M4 de features React y UI. Empieza tras M0 y usa fixtures hasta recibir M1-M3. Lee `AGENTS.md` y la especificacion vigente. Migra a `packages/features` y `packages/ui`: shell, sidebar, auth screens, Hoy, completion store unico, tema y responsive. Implementa `SessionExitCoordinator`: antes de AuthService.logout consulta DraftController M2, ofrece sync/guardar copia/descartar/cancelar, limpia timer M3, completions y QueryClient, y solo entonces cierra sesion; expiracion preserva draft bloqueado. Consume puertos/repositorios/proyector/timer sin importar Next, Supabase, Tauri o Capacitor. Implementa safe areas, viewport dinamico, teclado, Android back y drawer accesible. BlockNote no entra en chunks shell/Hoy. Prueba 360/768/1440, resume, logout y accesibilidad. No modifiques package/lock. Publica `docs/agents/handoffs/m4-features.md`.
