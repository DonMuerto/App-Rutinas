# Estrategia de pruebas

## Principio

Las pruebas no son una fase opcional. Cada owner prueba su logica interna; S6 mantiene fixtures contractuales, integracion transversal, RLS y E2E. Se usan herramientas locales y gratuitas.

## Capas

| Capa | Cobertura principal |
|---|---|
| Tipos y lint | Fronteras TypeScript strict, imports y reglas estaticas |
| Unitarias | Fecha local, validadores, proyector, orden y timer engine |
| Componentes | Activity, sidebar, Today, overlay, errores y accesibilidad |
| Datos/RLS | Constraints, grants y aislamiento por operacion |
| E2E | Recorridos completos desktop y movil |
| Build | SSR, boundaries cliente y produccion |

## Timer

Usar reloj inyectado, nunca esperas reales. Cubrir countdown, todas las fases, ceros, limites, ciclos/sets, deadline exacto, salto de varias fases, final total y cancelacion. Verificar que el motor no depende de React/DOM y que ninguna transicion invoca completion.

## Documento y proyeccion

Mantener fixtures para documento vacio, Activity countdown, intervalos, subtareas profundas, checklists normales, varias Activities, bloques invalidos/desconocidos y duplicados con IDs nuevos.

Verificar round-trip sin perdida, IDs estables, titulo separado, deteccion por ancestro mas cercano, estado diario no persistido, tolerancia parcial, orden estable y foco por ID.

## Fecha local

Controlar reloj y zona. Cubrir UTC- y UTC+, cercania a medianoche, cambio de dia con vista abierta, recuperacion de visibilidad, fecha especifica, cambio de zona y timer que cruza medianoche. Las pruebas no dependen de la fecha del equipo.

## RLS

Con Supabase local y sesiones reales:

- Usuario A puede operar sus rutinas y completions.
- Usuario B no puede seleccionar, insertar, actualizar ni borrar datos de A.
- B no puede referenciar una rutina de A al insertar completion.
- Anon no accede a tablas privadas.
- Grants permiten al rol authenticated usar Data API bajo RLS.
- Constraints rechazan recurrencia y completion invalidas.
- Reintentos no crean duplicados.

No usar service role en los casos que afirman aislamiento.

## E2E principal

1. Registrarse o iniciar sesion.
2. Crear y renombrar una rutina diaria.
3. Escribir bloques nativos e insertar Activity con `/`.
4. Configurar intervalos y anidar subtareas.
5. Guardar, recargar y comprobar IDs/estructura.
6. Crear rutina de fecha especifica.
7. Abrir Hoy y verificar seleccion/orden local.
8. Completar Activity y subtarea; comprobar sincronizacion con editor.
9. Ejecutar timer, cambiar de pestana y volver sin deriva.
10. Confirmar señal visual/sonora y completion manual.
11. Reordenar sidebar con puntero y alternativa accesible.
12. Cerrar sesion y perder acceso privado.

Tambien verificar que navegar internamente espera el autosave y que cerrar/recargar con cambios pendientes muestra advertencia. Confirmar el comportamiento de recuperacion read-only ante un tipo de bloque desconocido.

Ejecutar al menos en Chromium a 360 px y 1440 px; incluir 768 px en revision responsive. Usar roles y nombres accesibles como selectores, no clases Tailwind.

## SSR y cliente

Verificar que contenido privado no aparece antes de redireccion, BlockNote y APIs navegador no ejecutan en SSR, no hay errores de hidratacion, el tema inicial no parpadea incorrectamente y datos precargados no generan consultas duplicadas evitables.

## Gates

Una entrega no avanza si falla tipos, lint, build, unitarias criticas, RLS, E2E principal, responsive o accesibilidad minima. No se exige porcentaje arbitrario; timer, fecha, proyeccion, autosave y RLS deben cubrir todas sus ramas de riesgo.
