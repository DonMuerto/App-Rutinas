# Modulo del motor temporal

## Objetivo

Construir una maquina pura y determinista reusable sin React, DOM ni plataforma.

## Responsabilidades

- Validar configuraciones conforme a [timer.md](../contracts/timer.md).
- Construir un plan lineal de fases.
- Iniciar desde un timestamp y calcular deadlines.
- Avanzar usando el timestamp actual, incluso si vencieron varias fases.
- Exponer fase, restante, progreso, ciclo, set y transiciones.
- Cancelar y volver a idle.
- Permitir reloj inyectable en pruebas.
- Serializar/validar el estado minimo de restauracion sin realizar I/O.

## No objetivos

- No React, hooks, DOM, intervalos visuales, audio ni Supabase.
- No singleton global; pertenece al controller React.
- No completion, pausa, reanudacion, skip, reset ni acceso directo a storage.

## Invariantes

- Countdown es una sola fase de trabajo.
- Preparacion de intervalos ocurre como maximo una vez.
- Cada ciclo tiene trabajo.
- Solo hay descanso de ciclo si queda otro ciclo del mismo set.
- Solo hay descanso de set si queda otro set.
- Una fase de cero segundos no entra al plan.
- Una actualizacion exactamente en deadline entra en la fase siguiente.
- El deadline siguiente parte del anterior, no del tick tardio.
- Progreso siempre permanece entre cero y uno.
- El restante visible redondea hacia arriba y nunca es negativo.

## Vectores obligatorios

- Countdown de 60 segundos.
- Intervalo 10/20/10, ocho ciclos, un set: una preparacion, ocho trabajos, siete descansos.
- Dos sets con un unico descanso entre sets.
- Fases opcionales en cero.
- Tick que atraviesa una y varias fases.
- Tick posterior al final total.
- Configuraciones negativas, decimales, infinitas y fuera de rango.
- Cancelacion desde cada tipo de fase.
- Restauracion en mitad de fase, tras varias fases y despues de done.

## Handoff

Entregar API de plan/estado/transicion/serializacion y pruebas con reloj falso. Debe compilar en un paquete puro.
