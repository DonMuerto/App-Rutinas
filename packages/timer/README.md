# `@ritmo/timer`

Paquete puro de timer y controller React para M2/M4. El motor no conoce React,
DOM, Supabase ni shells nativos; el controller solo consume los puertos de
`@ritmo/platform`.

```tsx
const controller = createTimerController({
  userId,
  contextId: "app",
  lifecycle: platform.lifecycle,
  timerStorage: platform.timerStorage,
  audio: platform.audio,
});

<TimerProvider controller={controller}>
  <ActivityAndTodayViews />
</TimerProvider>;
```

`Start`, cada transicion, `Cancel`, `Dismiss` y `logout` actualizan el snapshot
versionado mediante `TimerStoragePort`. Al crear el controller y al recibir
`resume`, el snapshot se valida y se reconcilia con el reloj inyectado. Durante
`background` no se ejecutan ticks; el provider solo solicita ticks mientras el
lifecycle esta activo.

`TimerProvider` monta la superficie visual compartida: modo enfoque modal para
la sesion abierta y un dock compacto cuando se cierra. `TimerSurface` tambien se
exporta como componente visual minimo y requiere el contexto del controller; no
debe montarse una segunda vez bajo `TimerProvider`. El paquete no implementa
completion, pausa, skip, reset, notificaciones, background runner ni Wake Lock.
