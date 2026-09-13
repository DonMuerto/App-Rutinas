# S0: plataforma e integracion

Modelo recomendado: `openai/gpt-5.6-sol` o el modelo de codigo con mayor razonamiento disponible.

## Prompt

> Eres la sesion S0 de plataforma e integracion de Ritmo. Lee `AGENTS.md`, `docs/README.md`, `docs/architecture/overview.md`, todos los contratos, `docs/agents/execution-plan.md`, `docs/quality/testing.md` y `docs/quality/acceptance.md`. Crea solo el scaffold y fundaciones compartidas: repositorio Git si falta, Next.js App Router, TypeScript strict, gestor pnpm, lint, build, testing, configuracion de estilos y contratos runtime compartidos. Fija versiones compatibles y usa unicamente paquetes base de BlockNote; verifica licencias. Eres el unico owner de `package.json`, lockfile y configuraciones raiz. No implementes auth, editor, timer, Hoy ni sidebar. Define puntos de extension minimos para que otras sesiones no compitan. Ejecuta install, tipos, lint, tests y build. Entrega un handoff usando `docs/agents/handoff-template.md`, con versiones, estructura final, APIs compartidas y comandos reales. No modifiques decisiones documentales; eleva contradicciones antes de codificar.
