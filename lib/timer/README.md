# API publica del temporizador

> Esta API describe la implementacion web historica. ADR 0002 conserva el engine y reemplaza el store en memoria por un controller que consume LifecyclePort, TimerStoragePort y AudioPort dentro de `packages/timer`.

El editor y Hoy consumen esta frontera; no crean motores ni sesiones propias.

```tsx
import { useTimer, validateRunnableTimerConfig } from "@/components/timer";

const validation = validateRunnableTimerConfig(activity.props);
const timer = useTimer();

if (validation.success) {
  timer.start({
    config: validation.data,
    origin: {
      activityId: activity.id,
      activityTitle: activity.title,
      routineId: routine.id,
      routineName: routine.name,
    },
  });
}
```

`start` abre el modo enfoque si el singleton esta libre. Si devuelve
`reason: "occupied"`, el consumidor debe ofrecer `openFocus()` para volver a la
sesion existente. El input se copia al iniciar: editar o eliminar el origen no
cambia la sesion.

`TimerProvider` se monta una sola vez por contexto. En la arquitectura objetivo, el snapshot se persiste por usuario y se reconcilia al reanudar/reiniciar; no se ejecuta JavaScript en background ni se coordinan dispositivos.
