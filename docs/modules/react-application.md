# Modulo de aplicacion React

## Objetivo

Componer el cliente Vite compartido sin concentrar logica de producto en el entrypoint.

## Responsabilidades

- Crear raiz React y HashRouter.
- Inyectar PlatformServices segun target.
- Montar providers en orden documentado.
- Lazy-load de rutas, especialmente editor/BlockNote.
- Guard auth con estados de inicializacion/expiracion.
- Error boundaries por aplicacion y rutas pesadas.
- Limpiar estado ligado al usuario durante transiciones auth.
- Montar SessionExitCoordinator, que consume DraftController, timer, completions, QueryClient y AuthService en ese orden.

## No objetivos

- No contener queries, reglas de timer o parser documental.
- No detectar plataforma dentro de features.
- No usar SSR, RSC, Server Actions ni API routes.

## Rendimiento

BlockNote/Mantine quedan fuera del chunk inicial. Consultas independientes comienzan en paralelo. Listeners globales pertenecen a providers unicos. Proyeccion pesada puede diferirse sin retrasar escritura.

## Aceptacion

El bundle arranca por HTTP y desde assets locales; reinicio conserva ruta hash; editor queda en chunk separado; logout limpia caches/stores; un error de ruta no destruye drafts.
