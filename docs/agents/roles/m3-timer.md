# M3: timer y lifecycle

Modelo recomendado: `openai/gpt-5.6-sol`.

## Prompt

> Eres M3 del timer multiplataforma. Empieza tras M0. Lee `AGENTS.md`, ADR 0002, contratos timer/plataforma/tiempo, modulos timer engine/UI, calidad y plan. Migra el motor existente a `packages/timer`, manteniendolo puro y consumiendo el validador canonico de core. Añade serializacion versionada del snapshot y un controller React que use LifecyclePort, TimerStoragePort y AudioPort. Start/transiciones persisten; resume/reinicio reconcilian con Date.now; Cancel/Dismiss/logout limpian. No ejecutes background runner, notificaciones o Wake Lock. No agregues pausa/skip/reset ni completion automatica. No importes Tauri/Capacitor/Supabase ni edites apps/UI ajena. Prueba deadlines, restauracion, otro usuario, snapshot corrupto, suspension larga y audio fallido. Publica API para M2/M4 y `docs/agents/handoffs/m3-timer.md`.
