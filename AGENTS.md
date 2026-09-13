# Ritmo: instrucciones para agentes

Este archivo es la entrada obligatoria para cualquier agente que trabaje en el repositorio. Antes de modificar archivos, lee [docs/README.md](docs/README.md), el documento del modulo asignado y los contratos que consuma.

## Producto

Ritmo es un editor de documentos tipo Notion al que se agrega un bloque custom de Actividad con hora, completado diario y temporizador. Cada rutina es una pagina editable. El editor es el producto principal; no construyas una aplicacion de tareas con formularios separados.

## Reglas innegociables

- La Actividad se crea y edita dentro del documento BlockNote. Nunca crees una pantalla o ruta para editarla.
- Usa solamente paquetes base de BlockNote. No uses `@blocknote/xl-*` sin aprobacion explicita por su licencia GPL-3.0.
- No agregues servicios que exijan tarjeta de credito o una prueba con vencimiento.
- Mantener RLS habilitada y probada en todas las tablas privadas.
- El MVP no usa `SUPABASE_SERVICE_ROLE_KEY`.
- No implementes PWA, Service Worker, Web Notifications, Wake Lock ni Capacitor en el MVP.
- TypeScript debe permanecer en modo `strict`; evita `any`.
- Server Components por defecto. Usa componentes cliente solo para interactividad o APIs del navegador.
- El sidebar es una lista plana reordenable, no un arbol.
- `routines.name` es la unica fuente del titulo de una rutina.
- La vista Hoy no edita documentos: solo completa, inicia temporizadores y navega al origen.
- Solo puede existir un temporizador activo por pestana. Terminarlo no completa la actividad.
- La fecha operativa se calcula en la zona local del navegador.
- No modifiques contratos compartidos o archivos fuera del ownership de tu sesion sin coordinacion.

## Orden de lectura

1. [Indice documental](docs/README.md).
2. [Vision del producto](docs/product/vision.md) y [alcance MVP](docs/product/mvp-scope.md).
3. [Arquitectura](docs/architecture/overview.md) y [decisiones cerradas](docs/architecture/decisions/0001-mvp-decisions.md).
4. Los contratos y documentos de modulo indicados por el prompt de tu rol.
5. [Plan multiagente](docs/agents/execution-plan.md) y [plantilla de handoff](docs/agents/handoff-template.md).
6. [Criterios de aceptacion](docs/quality/acceptance.md) y [estrategia de pruebas](docs/quality/testing.md).

## Autoridad documental

En caso de contradiccion, prevalece este orden:

1. `AGENTS.md`.
2. ADRs en `docs/architecture/decisions/`.
3. Contratos en `docs/contracts/` y `docs/database/`.
4. Especificaciones en `docs/modules/`.
5. Criterios de aceptacion en `docs/quality/`.
6. Documentos de producto y operacion.
7. El plan de agentes regula ejecucion y ownership, pero no cambia comportamiento de producto.

No resuelvas contradicciones inventando comportamiento. Registra el bloqueo y solicita una decision al coordinador.

## Calidad minima

La implementacion final debe superar tipos, lint, pruebas unitarias, pruebas RLS, E2E y build de produccion. Las pruebas no son opcionales para timer, fecha local, proyeccion documental, autosave o seguridad.
