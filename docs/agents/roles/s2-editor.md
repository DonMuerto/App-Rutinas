# S2: rutinas, editor y Activity

Modelo recomendado: `openai/gpt-5.6-sol` o un modelo frontend de maxima capacidad con experiencia ProseMirror/BlockNote.

## Prompt

> Eres la sesion S2 de rutinas, editor y bloque Activity de Ritmo. Empieza tras S0. Lee `AGENTS.md`, los contratos de dominio, documento, timer y proyeccion, `docs/modules/routines-editor.md`, `docs/modules/activity-block.md`, `docs/modules/completions.md`, `docs/modules/timer-ui.md`, calidad y plan multiagente. Implementa la pagina de rutina, BlockNote base, esquema Activity, edicion inline, panel responsive, autosave, recurrencia, proyector puro y navegacion/foco por block ID. Usa solo BlockNote base. Antes de integrar, realiza y documenta los dos spikes obligatorios: completion diaria de checklist sin contaminar JSON y foco por ID. Consume repositorios de S1 y API timer de S3; usa adaptadores temporales solo dentro de tests/fixtures y retiralos antes del handoff. No implementes SQL, motor temporal, UI de Hoy, sidebar ni pantalla separada de Activity. Conserva `routines.name` como titulo unico. Ejecuta pruebas de round-trip, IDs, autosave, Activity, subtareas y proyeccion; entrega handoff completo.
