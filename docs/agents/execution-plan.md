# Plan de ejecucion multiagente

## Equipo recomendado

Siete sesiones de implementacion: una de plataforma/integracion y seis especializadas. Usar menos mezcla superficies criticas; usar mas aumenta conflictos en un repositorio pequeno.

| ID | Rol | Ownership durante implementacion |
|---|---|---|
| S0 | Plataforma e integracion | Config raiz, dependencias, contratos runtime compartidos e integracion final |
| S1 | Auth, datos y RLS | `supabase/**`, clientes Supabase, repositorios y rutas auth |
| S2 | Rutinas, editor y Activity | Editor, esquema BlockNote, Activity, ruta de rutina y proyector documental |
| S3 | Motor y UI de timer | Logica temporal, store, overlay, anillo y audio |
| S4 | Hoy y completions | Ruta/componentes Hoy, estado diario cliente e integraciones |
| S5 | Shell, sidebar y diseno | Layout visual, navegacion, sidebar, tema, CSS y primitives UI |
| S6 | Calidad y release | Harness de pruebas, fixtures contractuales, E2E, CI y evidencia |

Los tests unitarios internos pertenecen al owner del modulo. S6 posee pruebas de contrato, integracion transversal y E2E.

## Mapa de ownership por rutas

| Sesion | Rutas exclusivas despues del scaffold |
|---|---|
| S0 | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, configuraciones Next/lint/Tailwind/PostCSS/test, `components.json`, `.env.example`, `lib/contracts/**`, `lib/dates/**` |
| S1 | `supabase/**`, `lib/supabase/**`, `lib/repositories/**`, `components/providers/query-provider*`, `app/(auth)/**`, callback auth y `middleware.*`/`proxy.*` |
| S2 | `components/editor/**`, `lib/blocknote/**`, `lib/activities/**`, `app/(app)/rutinas/**` |
| S3 | `lib/timer/**`, `components/timer/**`, sonidos locales aprobados |
| S4 | `lib/completions/**`, `lib/today/**`, `components/today/**`, `app/(app)/hoy/**` |
| S5 | `app/layout.*`, `app/page.*`, `app/globals.css`, `app/(app)/layout.*`, `components/sidebar/**`, `components/shell/**`, `components/theme/**`, `components/ui/**` |
| S6 | `tests/contracts/**`, `tests/fixtures/**`, `tests/e2e/**`, `.github/workflows/**` |

Los tests unitarios junto a un modulo pertenecen a su owner. S6 crea los fixtures contractuales canonicos bajo `tests/fixtures`; S2 puede tener fixtures unitarios propios sin copiarlos como otra fuente de contrato.

S0 es el unico owner de dependencias y configuraciones. Otros agentes solicitan cambios; no ejecutan generadores que alteren archivos compartidos. S5 recibe layouts y CSS mediante handoff del scaffold. S3 exporta el provider/store y S5 solo lo monta. S1 exporta el guard/helper de sesion y S5 lo consume.

## Olas

### Ola 0: plataforma

Solo S0:

- Inicializar control de versiones si aun no existe.
- Crear Next.js con TypeScript strict y scripts de calidad.
- Fijar versiones compatibles de BlockNote base, Supabase, TanStack Query, shadcn/Tailwind, dnd-kit y testing.
- Verificar licencias y ausencia de paquetes XL.
- Crear tipos transversales minimos; S6 creara los fixtures contractuales.
- Publicar un handoff de scaffold antes de habilitar otras sesiones.

Gate: install, tipos, lint, tests vacios y build pasan; ownership y imports publicos estan claros.

### Ola 1: fundaciones paralelas

- S1 crea esquema, RLS, auth y repositorios.
- S2 realiza spikes BlockNote, esquema, serializacion y proyector puro.
- S3 implementa motor puro y pruebas deterministas.
- S5 implementa tokens, tema y shell/sidebar sobre datos simulados.
- S6 crea fixtures y matrices de contrato/RLS.
- S4 prepara read model de Hoy sobre fixtures, sin duplicar extractor ni repositorios.

Gate: RLS aislada, documentos round-trip, IDs estables, spikes resueltos, plan temporal correcto y shell responsive.

### Handoffs parciales obligatorios

1. S2 entrega esquema, adaptadores, resultado de spikes y proyector puro antes de integrar UI diaria.
2. S3 entrega validador y API publica del timer antes de que S2/S4 conecten Start.
3. S1 entrega repositorios, factories de query keys y auth antes de conexiones reales.
4. S4 entrega API cliente de completions, observador de fecha y optimistic update.
5. S2 consume la API de S4 para completar la integracion en editor.

Este orden elimina la dependencia circular: S4 no posee schema/proyector y S2 no posee persistencia/cache de completions.

### Ola 2: verticales

- S2 integra editor, Activity, autosave, recurrencia, completion diaria y foco por ID.
- S3 integra singleton, modo enfoque y audio.
- S4 conecta Hoy con repositorios, proyector, completions y timer.
- S5 conecta sidebar con repositorio, creación y reorder accesible.
- S1 completa session handling e invalidaciones acordadas.

Gate: recorridos de rutina y Hoy funcionan con sesion normal y sin accesos directos fuera de repositorios.

### Ola 3: integracion

S0 integra en este orden: plataforma, datos/auth, shell, editor, timer, Hoy y calidad. Un defecto interno vuelve al owner. S0 no reescribe features durante la integracion salvo cambios estrictamente compartidos.

Gate: tipos, lint, unitarias, RLS, E2E y build pasan juntos.

### Ola 4: endurecimiento

S6 ejecuta aceptacion completa. Owners corrigen sus hallazgos. Se revisan desktop/movil, teclado, tema, medianoche, throttling, fallos de autosave y dos usuarios.

## Dependencias

```text
S0 -> habilita a todos
S1 repositorios -> S2, S4, S5
S2 esquema y proyector -> S4
S3 API timer -> S2, S4
S5 layout privado -> monta provider de S3 y vistas
S1-S5 -> S6 integra y valida
```

S4 puede trabajar sobre fixtures antes de recibir S1/S2/S3. No puede cerrar su handoff con adaptadores temporales ni duplicados.

## Spikes bloqueantes de S2

1. Demostrar el comportamiento real de BlockNote al marcar una checklist descendiente y definir cómo superponer completion diaria sin contaminar el JSON.
2. Demostrar navegación, scroll y foco a un bloque estable por ID tras inicializar el editor.

Si falla un spike, S2 registra opciones y detiene la parte dependiente. Cambiar a un bloque custom de subtarea o alterar el contrato exige decision del coordinador.

## Reglas de coordinacion

- Cada archivo tiene un owner activo.
- No modificar documentación normativa desde sesiones de codigo.
- No crear compatibilidad con contratos antiguos: la aplicacion aun no tiene datos enviados.
- No usar service role, XL, PWA ni servicios de pago para desbloquear trabajo.
- No crear consultas Supabase dentro de componentes.
- No agregar pausa, skip, reset o edicion desde Hoy sin nuevo ADR.
- Cambios de contrato se proponen en el handoff antes de implementarse.
- Cambios inesperados ajenos se conservan y se coordinan; nunca se revierten silenciosamente.

## Gate de handoff

Una entrega incluye archivos, contratos consumidos/publicados, verificaciones, casos limite, riesgos y solicitudes. No se acepta "funciona" sin comandos y resultados reproducibles.
