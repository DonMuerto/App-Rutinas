# Ritmo: instrucciones para agentes

Este archivo es la entrada obligatoria. Antes de modificar archivos, lee [docs/README.md](docs/README.md), el documento del modulo asignado, sus contratos y el plan de ejecucion vigente.

## Producto

Ritmo es un editor de documentos tipo Notion con un bloque Activity que agrega hora, completion diaria y temporizador. Una unica aplicacion React se ejecuta en navegador, escritorio con Tauri y movil con Capacitor. El editor es el producto principal; no construyas una aplicacion de tareas con formularios separados.

## Arquitectura obligatoria

- React 19 + Vite como cliente SPA compartido.
- Tauri 2 empaqueta el mismo bundle para escritorio.
- Capacitor empaqueta el mismo bundle para Android/iOS.
- BlockNote base es el unico editor. React Native/Expo queda fuera porque BlockNote requiere DOM.
- Tauri y Capacitor son shells finos: la logica de producto no se bifurca por plataforma.
- Toda API de plataforma entra por puertos de lifecycle, storage, audio, navegacion y enlaces externos.
- Supabase JS y TanStack Query funcionan en cliente; RLS es la frontera real de seguridad.

## Reglas innegociables

- Activity se crea y edita dentro del documento BlockNote. Nunca crees una pantalla o ruta para editarla.
- Usa solamente paquetes base de BlockNote. No uses `@blocknote/xl-*` sin aprobacion explicita.
- No agregues servicios que exijan tarjeta o una prueba con vencimiento.
- Mantener RLS habilitada y probada en todas las tablas privadas.
- Nunca uses `SUPABASE_SERVICE_ROLE_KEY` en web, binarios, CI o runtime.
- Capacitor esta autorizado solo como contenedor. No implementes PWA, Service Worker, Web Notifications, notificaciones nativas, background runner ni Wake Lock en el MVP.
- TypeScript permanece en `strict`; evita `any`.
- No introduzcas dependencias de Next.js, Server Components, Server Actions ni `@supabase/ssr` en la arquitectura objetivo.
- Si una guia React mezcla recomendaciones Next.js, aplica solo las reglas neutrales de React/Vite e ignora APIs Next.
- El sidebar es una lista plana reordenable.
- `routines.name` es la unica fuente del titulo de rutina.
- Hoy no edita documentos: completa, inicia/abre timer y navega al origen.
- Existe un timer por contexto de ejecucion. Terminarlo no completa Activity.
- La fecha operativa usa la zona local del dispositivo.
- No llames APIs Tauri/Capacitor directamente desde features o dominio.
- No modifiques contratos o archivos fuera de ownership sin coordinacion.
- Cada sesion mantiene su handoff en `docs/agents/handoffs/` con la plantilla oficial.

## Orden de lectura

1. [Indice](docs/README.md).
2. [Vision](docs/product/vision.md) y [MVP](docs/product/mvp-scope.md).
3. [Arquitectura](docs/architecture/overview.md), [React multiplataforma](docs/architecture/react-multiplatform.md) y [ADR 0002](docs/architecture/decisions/0002-react-vite-tauri-capacitor.md).
4. Contratos y documentos del modulo asignado.
5. [Plan multiagente](docs/agents/execution-plan.md) y [handoff](docs/agents/handoff-template.md).
6. [Aceptacion](docs/quality/acceptance.md) y [pruebas](docs/quality/testing.md).

## Autoridad documental

1. `AGENTS.md`.
2. ADRs aceptados, prevaleciendo el de numero mayor cuando enmiende otro.
3. Contratos en `docs/contracts/` y `docs/database/`.
4. Especificaciones en `docs/modules/`.
5. Criterios en `docs/quality/`.
6. Producto y operacion.
7. El plan de agentes regula ownership, no comportamiento.

No inventes una solucion ante contradicciones. Registra el bloqueo y pide decision al coordinador.

## Calidad minima

La entrega debe superar tipos, lint, unitarias, RLS, E2E web, smoke Tauri, smoke Capacitor Android y builds aplicables. Timer, lifecycle, fecha local, proyeccion, draft journal, autosave y seguridad requieren pruebas.
