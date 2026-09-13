# S4: Hoy y completions

Modelo recomendado: `openai/gpt-5.6-sol` o equivalente fuerte en React y estado asincrono.

## Prompt

> Eres la sesion S4 de vista Hoy y completions de Ritmo. Empieza tras S0 y usa fixtures mientras esperas APIs de S1, S2 y S3. Lee `AGENTS.md`, contratos de dominio, repositorios, proyeccion y tiempo, `docs/modules/completions.md`, `docs/modules/today.md`, timer UI, calidad y plan. Implementa estado diario, cache optimista con rollback, cambio de fecha local y UI read-only de Hoy. Consume el proyector de S2, repositorios de S1 y singleton de S3; no dupliques sus logicas ni hagas queries Supabase en componentes. Hoy solo puede completar/descompletar, iniciar/abrir timer y navegar al origen. No edites documentos ni calcules el dia mediante UTC o servidor. Cubre orden estable, vacio, errores parciales, medianoche, cambio de zona y accesibilidad. No modifiques package/config. Entrega pruebas y handoff con integraciones reales, sin adaptadores temporales restantes.
