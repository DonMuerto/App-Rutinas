# Plantilla de handoff

## Identidad

- Sesion/rol:
- Ola/gate:
- Owner receptor:
- Base commit y estado de worktree:

## Cambios

- Archivos creados/modificados:
- Ownership y transferencias:
- Dependencias solicitadas a M0:
- Cambios concurrentes preservados:

## Contratos

- Documentos consumidos:
- API publica entregada:
- Cambios propuestos:
- Supuestos:

## Verificacion

- Tipos, lint, unitarias y build:
- RLS/E2E si aplica:
- Web/Tauri/Capacitor ejecutados:
- Plataformas no verificadas y motivo:
- Evidencia visual/dispositivo:

## Riesgos

- Casos limite:
- Limitaciones y bloqueos:
- Trabajo diferido:

## Confirmaciones

- Sin `any` injustificado ni secretos/service role.
- Sin RLS debilitada, XL, PWA, Service Worker, notificaciones, background runner o Wake Lock.
- Sin Activity separada del editor.
- Sin imports Tauri/Capacitor fuera de adaptadores.
- Sin Next/SSR nuevo en arquitectura objetivo.
- Sin modificaciones fuera de ownership no coordinadas.
