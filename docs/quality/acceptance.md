# Criterios de aceptacion

## Seguridad y auth

- A-01: registro, login, restauracion y logout funcionan.
- A-02: rutas privadas validan sesion en servidor.
- A-03: usuario A y B no acceden a datos ajenos por ninguna operacion.
- A-04: anon no accede a tablas privadas.
- A-05: RLS y grants estan probados, incluidos `WITH CHECK`.
- A-06: no existe service role en MVP.

## Rutinas y editor

- B-01: crear una rutina conduce al documento, no a un formulario de tarea.
- B-02: `routines.name` alimenta cabecera, sidebar y Hoy.
- B-03: texto, encabezados, listas, enlaces, checklists, slash, indentacion, drag, copy/paste y undo/redo funcionan dentro del alcance de BlockNote.
- B-04: Activity se inserta desde `/` y se edita inline/contextualmente.
- B-05: no existe pantalla o ruta para editar Activity.
- B-06: guardar/recargar conserva estructura, props e IDs.
- B-07: autosave muestra pendiente, guardando, exito y error sin perder edicion.
- B-08: solo se usan paquetes BlockNote base.
- B-09: navegacion interna no abandona cambios pendientes; cerrar/recargar advierte antes de una posible perdida.
- B-10: un bloque desconocido no montable abre recuperacion read-only y nunca se sobrescribe.

## Activity y subtareas

- C-01: Activity soporta hora ausente o `HH:mm`.
- C-02: soporta `none`, countdown e intervalos completos.
- C-03: configuracion invalida deshabilita Start sin impedir editar.
- C-04: subtareas se derivan de checklists descendientes y conservan profundidad.
- C-05: subtareas reinician completion por fecha sin perder texto o estructura.
- C-06: checklists fuera de Activity persisten su check normalmente.
- C-07: completar Activity y subtareas son acciones independientes.

## Hoy

- D-01: incluye todas las rutinas diarias y solo las especificas de la fecha local.
- D-02: no usa UTC ni fecha del servidor para decidir Hoy.
- D-03: ordena por hora, sin hora al final, posicion y orden documental.
- D-04: permite completar, iniciar/abrir timer y navegar.
- D-05: no permite editar ni escribe `routines.content`.
- D-06: cruzar medianoche refresca rutinas y completions.
- D-07: navegar al origen localiza el bloque o informa que ya no existe.

## Timer

- E-01: countdown usa una fase de trabajo y termina por deadline.
- E-02: intervalos respetan preparacion unica, ciclos, sets y descansos sin descanso final.
- E-03: throttling o perdida de foco no causa deriva acumulada.
- E-04: existe un solo timer por pestana y Start no reemplaza otro.
- E-05: navegacion cliente conserva el timer; recarga puede descartarlo.
- E-06: modo enfoque es un overlay del viewport sin Fullscreen API y muestra fase, restante, ciclo/set y progreso.
- E-07: transiciones producen señal visual y sonido cuando el navegador lo permite.
- E-08: sonido y color nunca son la unica señal.
- E-09: Cancel y done no completan Activity.
- E-10: no hay pausa, skip, reset, notificaciones, PWA ni Wake Lock.

## Shell y diseno

- F-01: sidebar es lista plana reordenable.
- F-02: reorder tiene alternativa por teclado y rollback.
- F-03: movil usa drawer; escritorio sidebar persistente/colapsable.
- F-04: 360, 768 y 1440 px no presentan scroll horizontal de pagina.
- F-05: tema claro/oscuro y BlockNote estan sincronizados.
- F-06: se respetan tokens, tipografias, contraste AA, foco y reduced motion.
- F-07: el editor domina visualmente; no hay layout de dashboard ni tarjetas repetidas.

## Calidad y operacion

- G-01: TypeScript strict, lint, unitarias y build pasan.
- G-02: pruebas RLS A/B/anon pasan.
- G-03: E2E principal pasa en desktop y movil.
- G-04: no hay errores de hidratacion en recorridos principales.
- G-05: no hay servicios con tarjeta obligatoria o trial con vencimiento.
- G-06: no hay paquetes XL ni features moviles diferidas.
- G-07: despliegue tiene smoke test y procedimiento de rollback.

La entrega MVP requiere todos los criterios. Una excepcion de seguridad, licencia, coste o perdida silenciosa de datos persistidos bloquea release. La salida confirmada por el usuario tras la advertencia nativa de cambios pendientes es la unica limitacion aceptada del cierre de pestana.
