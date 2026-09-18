# Contrato del documento BlockNote

## Documento raiz

`routines.content` contiene un envelope `{ schemaVersion, blocks }`. La version inicial es 1 y `blocks` contiene la coleccion BlockNote ordenada. Cada bloque conserva ID, tipo, contenido, props e hijos. El titulo de rutina queda fuera.

Una migracion envuelve arrays historicos como version 1; despues no se mantiene doble formato runtime. Futuras versiones usan migradores puros, secuenciales e idempotentes antes de montar BlockNote. Editor y proyector comparten validadores/migradores.

El contrato es independiente de plataforma. WebView2, Android WebView y WKWebView deben producir el mismo JSON para la misma edicion. Ningun bloque almacena rutas locales, handles nativos ni objetos de SDK.

## Activity version 1

| Campo | Canonico | Regla |
|---|---|---|
| Tipo | `activity` | Identifica el bloque custom |
| ID | Texto estable | Completion, timer y enlace de origen |
| Contenido | Inline rich text | Titulo visible de la actividad |
| `schemaVersion` | Entero `1` | Version del bloque |
| `scheduledTime` | `HH:mm` o ausencia | Hora civil local de 24 horas |
| `timerType` | `none`, `countdown`, `interval` | Discriminante |
| `countdownSeconds` | Entero | Usado solo por countdown |
| `prepareSeconds` | Entero | Usado solo por intervalos |
| `workSeconds` | Entero | Usado solo por intervalos |
| `restSeconds` | Entero | Usado solo por intervalos |
| `cycles` | Entero | Usado solo por intervalos |
| `sets` | Entero | Usado solo por intervalos |
| `restBetweenSetsSeconds` | Entero | Usado solo por intervalos |

Si BlockNote exige un valor no nullable para una prop, el adaptador puede codificar ausencia de hora como cadena vacia. Fuera del adaptador, la representacion canonica es ausencia, no una hora ficticia.

## Defaults de insercion

| Campo | Default |
|---|---|
| Titulo | Vacio con placeholder visible |
| Hora | Ausente |
| Timer | `none` |
| Countdown | 1800 segundos |
| Preparacion | 10 segundos |
| Trabajo | 20 segundos |
| Descanso | 10 segundos |
| Ciclos | 8 |
| Sets | 1 |
| Descanso entre sets | 60 segundos |

Los valores de tipos inactivos pueden conservarse para que cambiar de modalidad no destruya configuracion, pero se ignoran al validar, proyectar y ejecutar.

## Rangos de dominio

| Magnitud | Rango valido |
|---|---|
| Countdown | 60 a 86400 segundos |
| Preparacion | 0 a 3600 segundos |
| Trabajo | 1 a 3600 segundos |
| Descanso | 0 a 3600 segundos |
| Ciclos | 1 a 100 |
| Sets | 1 a 20 |
| Descanso entre sets | 0 a 3600 segundos |

Todos los valores son enteros finitos. La UI puede imponer pasos mas grandes, pero el contrato persistido acepta cualquier entero del rango.

## Titulo y texto proyectado

El editor puede conservar marcas y links inline soportados por BlockNote. Hoy y el modo enfoque producen un titulo de texto plano concatenando el texto visible. Un titulo vacio se presenta como "Actividad sin titulo" solo en UI accesible; ese fallback no se persiste.

## Descendencia

- Una subtarea diaria es una checklist que tiene una Activity entre sus ancestros.
- Pertenece al ancestro Activity mas cercano.
- La profundidad y el orden se conservan en la proyeccion.
- El estado diario visible no debe quedar incorporado como `checked` permanente al guardar.
- Al entrar o salir del ambito Activity, el destino comienza desmarcado y no se transfiere estado.
- Mientras sea subtarea, `checked` nativo se ignora y se normaliza a falso en el documento persistido.

## Datos invalidos

- Un bloque Activity parcialmente invalido sigue siendo editable.
- Una hora invalida se trata como ausente para orden, con diagnostico visible en editor.
- Una configuracion de timer invalida deshabilita Start.
- Un bloque sin ID no permite completion ni enlace preciso.
- Props Activity invalidas se conservan para que el usuario pueda corregirlas.
- Si existe un tipo de bloque desconocido que BlockNote no puede montar sin perdida, el editor entra en recuperacion read-only, conserva el JSON original y bloquea autosave. No elimina ni transforma el bloque.
- No se corrigen ni eliminan datos silenciosamente durante una lectura.

## Fixtures contractuales

Calidad debe mantener documentos representativos para: vacio, Activity countdown, intervalos con subtareas profundas, checklists normales, varias Activities, datos invalidos, tipo desconocido y copia con IDs distintos. Los fixtures se ejecutan contra el modelo puro y en smoke real de BlockNote para navegador y WebViews disponibles.
