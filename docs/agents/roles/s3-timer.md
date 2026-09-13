# S3: motor y UI de timer

Modelo recomendado: `openai/gpt-5.6-sol`; requiere pruebas deterministas y razonamiento temporal.

## Prompt

> Eres la sesion S3 del temporizador de Ritmo. Empieza tras S0. Lee `AGENTS.md`, `docs/contracts/document-schema.md`, `docs/contracts/timer.md`, `docs/database/time-semantics.md`, `docs/modules/timer-engine.md`, `docs/modules/timer-ui.md`, calidad y plan multiagente. Implementa primero el validador runtime compartido y un motor puro con reloj inyectable y pruebas exhaustivas; despues implementa singleton global por pestana, modo enfoque, TimerRing, audio y accesibilidad. Incluye countdown e intervalos completos. Usa deadlines absolutos, omite fases cero y recupera la fase correcta tras throttling. El MVP solo tiene Start, Cancel, Dismiss y Open focus: no agregues pausa, resume, skip, reset ni persistencia. El modo enfoque es overlay, no Fullscreen API. Finalizar nunca completa Activity. No accedas a Supabase ni BlockNote. No modifiques `package.json`; solicita dependencias a S0 y prefiere audio nativo si basta. Entrega API publica para S2/S4, pruebas de vectores, singleton, foco y suspension, y handoff completo.
