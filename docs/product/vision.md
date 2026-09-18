# Vision del producto

## Propuesta

Ritmo combina un editor de documentos libre con actividades ejecutables. Cada rutina es una pagina tipo Notion en la que conviven notas, encabezados, listas, enlaces, checklists y bloques Activity. La misma experiencia React funciona en navegador, PC y movil sin duplicar el dominio ni el documento.

La Actividad no es una entidad editada en otra pantalla. Es un bloque del documento con titulo inline, hora opcional, completado diario y temporizador opcional.

## Casos guia

### Rutina diaria de noche

Una pagina llamada Noche contiene notas libres, una Actividad Ejercicio a las 21:00 con preparacion, trabajo, descanso, ciclos y sets, y checklists anidados para calentamiento, circuito y estiramiento. Al dia siguiente, la actividad y sus subtareas vuelven a estar sin completar sin perder sus textos.

### Lectura

En la misma pagina existe una Actividad Lectura a las 23:00 con countdown. Se configura desde el propio bloque y se ejecuta en un modo enfoque sin navegar a una pantalla de tarea.

### Plan puntual

Una pagina Viaje a Valparaiso tiene fecha especifica. Sigue existiendo y puede editarse cualquier dia, pero sus actividades solo aparecen en Hoy cuando coincide la fecha local.

## Principios

- Notion primero: la superficie principal es el documento.
- Edicion contextual: titulo, hora y configuracion pertenecen al bloque.
- Estado diario separado: completar no reescribe la definicion de la rutina.
- Tiempo fiable con pestana abierta: los deadlines absolutos evitan deriva por throttling.
- Mobile-first sin sacrificar escritorio.
- Privacidad por defecto mediante RLS.
- Coste cero para el MVP, sin trials con vencimiento.
- Accesibilidad: teclado, foco, contraste y alternativas a color y sonido.
- Un producto, tres contenedores: web, Tauri y Capacitor comparten UI y reglas.
- Adaptacion, no forks: layout, input y lifecycle cambian mediante capacidades.
- Datos online-first con proteccion local de borradores; no se promete edicion offline completa.

## Plataformas

- Web es el canal universal y de desarrollo rapido.
- Tauri ofrece una app instalable para PC, con Windows como gate primario.
- Capacitor ofrece una app movil, con Android como gate primario.
- macOS, Linux e iOS comparten arquitectura, pero sus releases dependen de hardware, firma y cuentas externas.
- BlockNote se ejecuta dentro del WebView nativo; no se reimplementa en React Native.

## Lenguaje visual

La interfaz utiliza espacio, tipografia y jerarquia, no tarjetas repetidas. El bloque Actividad es el unico bloque con personalidad visual adicional. Trabajo usa ambar, descanso verde salvia y errores coral, siempre junto con texto o iconografia.

Tipografias previstas: Space Grotesk para titulos y numeros del timer; Inter para documento e interfaz. Los numeros vivos usan cifras tabulares.
