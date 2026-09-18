# Handoff S0: plataforma e integracion

> Handoff historico de la arquitectura Next.js. Conservado como evidencia; el plan M0-M5 y ADR 0002 lo superseden.

## Identidad

- Sesion: S0.
- Rol: plataforma e integracion.
- Alcance terminado: scaffold de Ola 0, configuracion raiz, dependencias, contratos runtime compartidos, pruebas fundacionales, repositorio Git y publicacion inicial.
- Owner receptor: S1-S6.
- Ola/gate: Ola 0 superada; S1-S6 pueden comenzar.
- Repositorio: <https://github.com/DonMuerto/App-Rutinas>.
- Rama publicada: `main`.
- Commit inicial: `37bdff914b91acc50bf6a70ce89bb9cd2bc845e1` (`chore: bootstrap Ritmo application`).

## Cambios

- Archivos creados: scaffold Next.js App Router en `app/**`; contratos y pruebas en `lib/contracts/**`; fecha local y pruebas en `lib/dates/**`; configuraciones raiz de TypeScript, Next.js, ESLint, Prettier, Tailwind/PostCSS, shadcn, Vitest y Playwright; `package.json`, `pnpm-lock.yaml`, `.env.example`, ignores y atributos Git.
- Archivos modificados: ninguno pendiente al publicar el commit inicial.
- Archivos compartidos tocados con autorizacion: `app/layout.tsx`, `app/page.tsx` y `app/globals.css` como scaffold temporal que recibe S5; configuraciones raiz y `lib/contracts/**` bajo ownership de S0.
- Dependencias solicitadas o agregadas por S0: Next.js `16.3.5`, React `19.3.0`, TypeScript `6.0.3`, BlockNote base `0.54.2`, Mantine `9.6.1`, Supabase JS `2.116.0`, Supabase SSR `0.12.7`, TanStack Query `5.102.8`, Tailwind CSS `4.3.3`, shadcn `4.21.0`, dnd-kit, Zod `4.6.4`, Vitest `5.0.0`, Testing Library y Playwright `1.63.0`.
- `next-env.d.ts` se versiona como archivo generado requerido por Next.js, se excluye en `.prettierignore` y se normaliza a LF mediante `.gitattributes`.
- `.next/`, `node_modules/` y `tsconfig.tsbuildinfo` permanecen ignorados y no fueron publicados.
- `.env.example` contiene solamente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ambas sin valor.

## Contratos

- Contratos consumidos: `docs/contracts/domain.md`, `docs/contracts/document-schema.md`, `docs/contracts/timer.md`, `docs/contracts/repositories.md`, `docs/contracts/activity-projection.md`, `docs/database/schema-rls.md` y `docs/database/time-semantics.md`.
- API publica entregada: `@/lib/contracts` exporta contratos Zod y tipos de Activity, completion, fecha, errores y rutinas; `@/lib/dates` exporta `getLocalDate()`; `@/lib/utils` exporta `cn()`.
- Validador runtime canonico: `activityTimerConfigSchema`, exportado por `@/lib/contracts`, es el unico validador runtime compartido para configuraciones `none`, `countdown` e `interval` y sus rangos contractuales.
- Obligacion de consumidores: S2 y S3 deben importar y consumir `activityTimerConfigSchema`; no deben crear validadores duplicados de configuracion de timer.
- Cambios de contrato propuestos: ninguno.
- Supuestos adoptados: `routineDocumentSchema` valida solo la coleccion raiz; S2 conserva ownership sobre validacion, adaptacion y serializacion interna de bloques BlockNote.

## Verificacion

- Comandos ejecutados: `npm exec --yes pnpm@10.17.1 -- typecheck`, `npm exec --yes pnpm@10.17.1 -- lint`, `npm exec --yes pnpm@10.17.1 -- test`, `npm exec --yes pnpm@10.17.1 -- format`, `npm exec --yes pnpm@10.17.1 -- build` y `npm exec --yes pnpm@10.17.1 -- licenses list --prod`.
- Resultado de tipos: exit code 0; `tsc --noEmit` termino sin diagnosticos.
- Resultado de lint: exit code 0; ESLint termino sin errores ni warnings.
- Resultado de pruebas del modulo: exit code 0; 3 archivos y 9 pruebas aprobadas.
- Resultado de formato: exit code 0; `All matched files use Prettier code style!`.
- Resultado de build: exit code 0; Next.js compilo, valido TypeScript y prerenderizo `/` y `/_not-found` como rutas estaticas.
- Resultado de licencias: exit code 0; BlockNote core/react/mantine usan `MPL-2.0`; no existen paquetes `@blocknote/xl-*`.
- Evidencia adicional RLS/E2E/visual: Playwright quedo configurado para Chromium a 360 px y 1440 px. Pruebas RLS y E2E quedan para S1 y S6 porque sus implementaciones aun no existen.
- Estado Git verificado: `main` limpio y sincronizado con `origin/main` en el commit inicial.
- Revision de seguridad: no se encontraron secretos, tokens, certificados, claves privadas ni variables de service role.

## Riesgos

- Casos limite cubiertos: fechas de calendario imposibles y bisiestas, hora civil de 24 horas, limites inclusivos del timer, valores de modalidades inactivas y ambito de completions de Activity/checklist.
- Limitaciones conocidas: no hay todavia implementacion ni pruebas funcionales de auth, RLS, editor, timer, Hoy o sidebar.
- Trabajo diferido: verticales funcionales y pruebas transversales segun ownership S1-S6.
- Bloqueos para consumidores: ninguno.

## Confirmaciones obligatorias

- No se uso `any` injustificado.
- No se introdujo `SUPABASE_SERVICE_ROLE_KEY`.
- No se debilito RLS.
- No se agregaron paquetes `@blocknote/xl-*`.
- No se implemento PWA, Service Worker, Web Notifications o Wake Lock.
- No se creo una pantalla de edicion de Activity.
- No se implemento auth, editor, timer, Hoy, sidebar ni otras funcionalidades fuera de Ola 0.
- No se modificaron decisiones, contratos ni documentos normativos.
- No se modificaron archivos fuera del ownership sin coordinacion.
