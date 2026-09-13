# ADR 0001: decisiones cerradas del MVP

Estado: aceptada.

## Decisiones

| Tema | Decision | Consecuencia |
|---|---|---|
| Timer | Countdown, intervalos completos y modo enfoque entran en MVP | Motor y UI se prueban desde la primera entrega |
| Sidebar | Lista plana reordenable | No existe `parent_id` ni drag jerarquico |
| Titulo de rutina | `routines.name` es fuente unica | No hay bloque de titulo duplicado |
| Subtareas | Checklists descendientes de Activity usan completion diaria | Su check no se considera estado permanente del JSON |
| Otros checklists | Conservan estado nativo persistente | Solo cambia la semantica dentro de Activity |
| Fecha | Zona local actual del navegador | Backend recibe `YYYY-MM-DD` explicito |
| Hoy | Completar, iniciar y navegar; no editar | Toda edicion ocurre en la rutina |
| Timer concurrente | Uno por pestana | Un segundo Start no reemplaza al activo |
| Fin del timer | No completa la actividad | Completion siempre manual |
| Recuperacion timer | No persiste tras recarga o cierre | Persistencia movil queda fuera del MVP |
| Controles timer | Start, Cancel, Dismiss y Open focus | No hay pausa, resume, skip ni reset |
| Preparacion | Una vez al inicio del plan de intervalos | No se repite por set |
| Descansos | No hay descanso de ciclo o set despues del ultimo trabajo aplicable | El plan no termina en descanso |
| Estado diario | Una tabla `block_completions` | Activity y subtareas comparten mecanismo y conservan ambito |
| Service role | No se usa ni configura en MVP | Toda operacion privada usa sesion y RLS |
| Registro | Confirmacion de email deshabilitada en MVP | Registro crea sesion sin depender de SMTP |

## Aclaraciones

- Una rutina de fecha especifica sigue existiendo y puede editarse fuera de su fecha; solo queda fuera de Hoy.
- Una Actividad puede estar vacia durante edicion, pero no puede iniciar un timer invalido.
- Completar actividad y subtareas son acciones independientes.
- La hora programada ordena y presenta; no dispara automaticamente el timer.
- Una Activity no puede ser descendiente de otra Activity. Si aparece en datos invalidos, ambas pueden mostrarse pero sus ambitos de subtareas se delimitan por el ancestro Activity mas cercano.

## Cambio de decision

Modificar cualquiera de estas decisiones exige un nuevo ADR, actualizacion de contratos y reevaluacion de los agentes consumidores antes de escribir codigo dependiente.
