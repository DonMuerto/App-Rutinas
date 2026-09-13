# Roles y prompts de inicio

Se recomiendan siete sesiones adicionales. Ejecutar primero S0. Iniciar S1-S6 solo despues de que S0 publique el handoff del scaffold. S4 puede usar fixtures hasta recibir dependencias; S6 puede preparar calidad desde la Ola 1.

| Sesion | Prompt |
|---|---|
| S0 | [Plataforma e integracion](s0-platform.md) |
| S1 | [Auth, datos y RLS](s1-data-auth.md) |
| S2 | [Rutinas, editor y Activity](s2-editor.md) |
| S3 | [Timer](s3-timer.md) |
| S4 | [Hoy y completions](s4-today.md) |
| S5 | [Shell, sidebar y diseno](s5-shell.md) |
| S6 | [Calidad y release](s6-quality.md) |

## Modelo recomendado

Usar un modelo fuerte en codigo, razonamiento y herramientas para todas las sesiones, preferentemente `openai/gpt-5.6-sol` si esta disponible en la instalacion. S1, S2, S3 y S0 no deben asignarse a modelos rapidos o de bajo razonamiento por los riesgos de RLS, serializacion, tiempo e integracion. S5 puede usar un modelo especializado en frontend solo si respeta estrictamente el sistema visual existente. S6 necesita capacidad de ejecutar y diagnosticar pruebas, no solo revisar texto.
