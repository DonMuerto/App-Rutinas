# Modulo de shell, sidebar y sistema visual

## Intencion

Ritmo es un editor, no un dashboard. El shell facilita navegacion y estado global sin encerrar cada seccion en tarjetas. El documento mantiene el protagonismo.

## Shell

La raiz React compone plataforma, auth, QueryClient, tema, timer, completions, sidebar y outlet. Providers de alta frecuencia se aislan para no rerenderizar toda la app.

En escritorio el sidebar es persistente/colapsable. En movil o ventana estrecha es drawer. Escape, Android back, cierre al navegar y retorno de foco son obligatorios.

## Sidebar plano

Orden: identidad minima, Hoy, separador, rutinas, Nueva pagina y controles inferiores. Cada rutina muestra icono, `routines.name` y fecha breve cuando aplique.

dnd-kit solo reordena la lista de rutinas. Debe existir alternativa Mover arriba/Mover abajo para teclado y tactil. El reorder es optimista, muestra destino y revierte ante error. Nunca crea relaciones padre-hijo.

## Responsive

| Rango | Comportamiento |
|---|---|
| Menos de 768 px | Drawer, barra compacta, editor con margenes reducidos, paneles como sheet si no caben |
| Desde 768 px | Sidebar persistente, columna de lectura contenida y espacio para controles BlockNote |

Viewport minimo 360 px. Usar viewport dinamico y safe-area insets. Sin scroll horizontal; controles tactiles de al menos 44 px; teclado virtual no tapa acciones.

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

Space Grotesk se reserva para titulos/timer e Inter para cuerpo/UI. Un ThemeProvider neutral sincroniza sistema, preferencia y BlockNote; no usa `next-themes`.

## Evitar

- Tarjetas y sombras repetidas.
- Eyebrows en mayusculas.
- Flechas decorativas en botones.
- Acentos neon o crema+terracota.
- Animaciones de entrada repetidas.
- Barra superior pesada propia de dashboard.

## Estados y accesibilidad

Cubrir arranque, offline/error, conflicto de draft, sesion expirada, lifecycle, reorder y drawer. Contraste AA, foco, icon labels y reduced motion son obligatorios.

## Handoff

Entregar features React shell/sidebar/Hoy, tema y primitives DOM. No importar Next, Tauri, Capacitor ni Supabase directo.
