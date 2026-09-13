# Modulo de shell, sidebar y sistema visual

## Intencion

Ritmo es un editor, no un dashboard. El shell facilita navegacion y estado global sin encerrar cada seccion en tarjetas. El documento mantiene el protagonismo.

## Shell

El layout privado compone validacion de sesion, sidebar, contenido, tema, Query provider y timer global. Debe permanecer Server Component salvo islas interactivas concretas. No marcar todo el layout como cliente por conveniencia.

En escritorio, el sidebar es persistente y colapsable, entre 240 y 280 px. En movil, es un drawer inicialmente cerrado. Cerrar al navegar, Escape y retorno de foco son obligatorios.

## Sidebar plano

Orden: identidad minima, Hoy, separador, rutinas, Nueva pagina y controles inferiores. Cada rutina muestra icono, `routines.name` y fecha breve cuando aplique.

dnd-kit solo reordena la lista de rutinas. Debe existir alternativa Mover arriba/Mover abajo para teclado y tactil. El reorder es optimista, muestra destino y revierte ante error. Nunca crea relaciones padre-hijo.

## Responsive

| Rango | Comportamiento |
|---|---|
| Menos de 768 px | Drawer, barra compacta, editor con margenes reducidos, paneles como sheet si no caben |
| Desde 768 px | Sidebar persistente, columna de lectura contenida y espacio para controles BlockNote |

Viewport minimo de aceptacion: 360 px. No debe existir scroll horizontal de pagina. Los controles tactiles esenciales tienen al menos 44 por 44 px.

## Tokens

| Token | Claro | Oscuro |
|---|---|---|
| Canvas | `#F3F4F7` | `#10121C` |
| Surface | `#FFFFFF` | `#181B29` |
| Ink | `#1B2033` | `#E7E9F2` |
| Ink muted | `#5B6478` | `#8B92A8` |
| Brand | `#3B4BA6` | `#6C7CE0` |
| Border | `#E2E4EC` | `#252A3D` |

Trabajo: `#E8963D`; descanso: `#4E9A82`; destructivo: `#D96666`. Los colores semanticos no se usan como adorno.

Space Grotesk se reserva para titulos y timer; Inter para cuerpo y UI. `next-themes` controla shell y BlockNote sin flash de tema incorrecto.

## Evitar

- Tarjetas y sombras repetidas.
- Eyebrows en mayusculas.
- Flechas decorativas en botones.
- Acentos neon o crema+terracota.
- Animaciones de entrada repetidas.
- Barra superior pesada propia de dashboard.

## Estados y accesibilidad

Cubrir carga, vacio, error, rutina no encontrada, sesion expirada, reorder pendiente y sidebar abierto/cerrado. Contraste AA, foco visible, nombres para icon buttons, drawer accesible y reduced motion son obligatorios.

## Handoff

Entregar layout, tokens, tema, sidebar, drawer, reorder accesible y componentes base necesarios. No modificar editor, timer ni repositorios; consumir sus contratos.
