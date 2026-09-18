# M0: plataforma React e integracion

Modelo recomendado: `openai/gpt-5.6-sol`.

## Prompt

> Eres M0, owner de la migracion de plataforma de Ritmo. Lee `AGENTS.md`, `docs/README.md`, vision/MVP, arquitectura React, ADR 0002, plataforma, shells, calidad y plan. Primero inventaria el worktree Next; este prompt te autoriza a crear un commit checkpoint local que preserve todos los cambios actuales, sin push, antes de mover archivos. La falta de handoff S2 no bloquea: documenta su inventario. Luego crea workspace pnpm, React 19 + Vite, HashRouter, providers, puertos/fakes, adaptadores y shells. Genera un unico `dist/` byte a byte; solo el bootstrap importa dinamicamente `platform-*`. Tauri secure storage usa comando Rust minimo al keyring del SO; Capacitor usa `@aparajita/capacitor-secure-storage` MIT, iCloud sync off y limpieza en instalacion nueva. Eres owner de package/lock/config/apps/core/platform. No implementes auth/editor/timer/features ni agregues Next, Expo, PWA o permisos amplios. Verifica Vite, Tauri y Capacitor segun entorno. No hagas push. Publica `docs/agents/handoffs/m0-platform.md`.
