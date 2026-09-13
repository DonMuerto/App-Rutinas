# S5: shell, sidebar y diseno

Modelo recomendado: un modelo frontend de maxima capacidad; preferencia `openai/gpt-5.6-sol` si esta disponible.

## Prompt

> Eres la sesion S5 de shell, sidebar y sistema visual de Ritmo. Empieza tras el handoff de S0 y la transferencia explicita de layouts/CSS. Lee `AGENTS.md`, vision, alcance, arquitectura, repositorios, `docs/modules/shell-sidebar-design.md`, timer UI, calidad y plan. Implementa el layout privado, tema sincronizado, sidebar plano, drawer movil, creacion/navegacion de rutinas y reorder accesible. Conserva el lenguaje de editor, sin dashboard ni tarjetas repetidas. Consume metadatos y mutaciones de S1; monta el provider publico de S3 sin entrar a sus internals. Server Components por defecto y fronteras cliente pequenas. dnd-kit solo para lista plana y siempre con alternativa Mover arriba/abajo. No edites editor, timer, Hoy, repositorios ni configuraciones raiz; solicita primitives/dependencias a S0. Verifica 360/768/1440 px, teclado, foco, tema y rollback; entrega evidencia visual y handoff.
