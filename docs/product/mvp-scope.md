# Alcance del MVP

## Incluido

- Workspace pnpm con React 19, Vite y TypeScript strict.
- Un bundle UI compartido para web, Tauri 2 y Capacitor.
- React Router con rutas estaticas compatibles con shells nativos.
- Registro, login, restauracion de sesion y logout con email y contrasena.
- Area privada protegida.
- Crear, renombrar, configurar recurrencia, eliminar y reordenar rutinas.
- Sidebar plano responsive.
- Editor BlockNote con texto, encabezados, listas, enlaces, checklists, slash menu, drag and drop e indentacion.
- Bloque custom Actividad editable inline.
- Hora programada opcional.
- Timer desactivado, countdown o intervalos completos.
- Preparacion, trabajo, descanso, ciclos, sets y descanso entre sets.
- Modo enfoque global a pantalla completa.
- Sonido y cambio visual al finalizar fases mientras la aplicacion esta abierta.
- Completado diario manual de actividades.
- Completado diario manual de checklists descendientes de una Actividad.
- Persistencia normal para checklists fuera de una Actividad.
- Recurrencia diaria y fecha especifica.
- Vista Hoy agregada según fecha local del navegador.
- Tema claro y oscuro sincronizado con BlockNote.
- Estados de carga, vacio, guardado y error.
- Draft journal local para recuperar cambios no sincronizados tras suspension o cierre inesperado.
- Reconciliacion de timer y fecha al reanudar la aplicacion.
- Build web estatico, build Tauri Windows y build Capacitor Android.
- Configuracion preparada para macOS, Linux e iOS sin exigir publicacion en tiendas.
- Pruebas unitarias, RLS, integracion y E2E de recorridos criticos.

## Excluido

- Pantalla separada de tareas o actividades.
- Arbol de paginas, carpetas o rutinas anidadas.
- Edicion de documentos desde Hoy.
- Inicio automatico por hora programada.
- Completion automatica al terminar un timer.
- Colaboracion simultanea o resolucion avanzada de conflictos.
- Sincronizacion de timer entre dispositivos o contextos simultaneos.
- Pausa, reanudacion, skip y reset del timer.
- PWA, Service Worker, Web Notifications, notificaciones nativas, background runner, Wake Lock y vibracion.
- Historial visible, rachas, estadisticas o calendario.
- Recurrencias semanales, reglas por dias o excepciones.
- Adjuntos, storage, exportacion PDF o paquetes BlockNote XL.
- Equipos, organizaciones, OAuth social o administracion privilegiada.
- Confirmacion de email y recuperacion de contrasena dependiente de SMTP.
- React Native/Expo y una UI movil separada.
- Multiwindow Tauri.
- Edicion offline completa o merge colaborativo.
- Publicacion App Store/Google Play, firma comercial y notarizacion.

## Recorrido principal

1. El usuario inicia sesion.
2. Crea una rutina diaria y entra directamente a su documento.
3. Escribe contenido libre e inserta una Actividad desde `/`.
4. Configura hora e intervalos dentro del bloque.
5. Anida checklists como subtareas.
6. Guarda y recarga sin perder estructura ni IDs.
7. Abre Hoy, completa subtareas o actividad e inicia el timer.
8. El modo enfoque atraviesa las fases con precision y emite señales.
9. Finalizar el timer no marca la actividad.
10. Al cambiar el dia local, los estados diarios aparecen reiniciados.
11. Al suspender y reanudar PC/movil, fecha, auth, drafts y timer se reconcilian.

## Definicion de Notion-like

El MVP no promete paridad completa con Notion. Debe verificar: escritura continua, Enter para nuevos bloques, Backspace coherente, slash menu, Tab y Shift+Tab, drag and drop, copy/paste, undo/redo, links, checklists y seleccion por teclado en los comportamientos soportados por BlockNote. No se reimplementan internals que BlockNote ya proporciona.

En movil se prueban ademas teclado virtual, seleccion tactil, safe areas, scroll con teclado, boton atras, clipboard y memoria. Drag and drop tactil puede ofrecer una alternativa accesible cuando el WebView no iguale escritorio.
